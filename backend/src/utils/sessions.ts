import type { DeviceType } from '@/config'
import { appConfig } from '@/config'
import { db, toKey } from '@/db'
import type { AddonMode, ResDetails } from '@/models/ResDetails'
import { getResDetails } from '@/reservations'
import { TZDate } from '@date-fns/tz'
import { eachDayOfInterval, formatISO } from 'date-fns'
import { logger } from './logger'

const WEEK = 60 * 60 * 24 * 7

function getToday() {
  return formatISO(TZDate.tz(appConfig.tz), {
    representation: 'date',
  })
}

function getSessionsSum(
  res: ResDetails,
  deviceType: DeviceType,
  addonMode: AddonMode,
  untilDate: string
) {
  // We need to check how many sessions we had in previous days
  const days = eachDayOfInterval({
    start: res.arrivalDate,
    end: untilDate,
  })

  // Summing up sessions
  return days.reduce((acc, day) => {
    const sessions =
      db().get<number>(
        toKey(
          'sessions',
          deviceType,
          res.number,
          addonMode,
          formatISO(day, {
            representation: 'date',
          })
        )
      ) || 0
    return acc + sessions
  }, 0)
}

function canStartToday(res: ResDetails, deviceType: DeviceType, today: string) {
  const resNumber = res.number
  const resAddons = res.addons

  const deviceAddons = resAddons.filter((addon) => addon.type === deviceType)

  return deviceAddons
    .map((addon) => {
      switch (addon.mode) {
        case 'per-session': {
          const sessions =
            db().get<number>(
              toKey('sessions', deviceType, resNumber, 'per-session')
            ) || 0
          return sessions < addon.quantity
        }
        case 'per-day': {
          // Getting todays sessions
          const sessions =
            db().get<number>(
              toKey('sessions', deviceType, resNumber, 'per-day', today)
            ) || 0

          // If started today we can allow more sessions
          if (sessions > 0) {
            return true
          }

          // Otherwise we need to calculate sessions sum from previous days
          const allSessions = getSessionsSum(res, deviceType, addon.mode, today)

          // Checking if we can start session
          return allSessions < addon.quantity
        }
        case 'per-stay': {
          // If per-stay is unlimited, return true
          return true
        }
      }
    })
    .some((result) => result)
}

export async function canStartSession(res: ResDetails, deviceType: DeviceType) {
  // Getting today
  const today = getToday()

  // Checking if session can be started
  const canStart = canStartToday(res, deviceType, today)

  // If session can't be started let's try reloading reservation addons
  if (!canStart) {
    // Getting new reservation details
    const resDetails = await getResDetails(res.number, res.lastName).catch(
      (error) => {
        logger.error('Error getting reservation details', error)
      }
    )

    // If we can't get reservation details, let's return true
    if (!resDetails) {
      return true
    }

    // Checking if session can be started
    return canStartToday(resDetails, deviceType, today)
  }

  return canStart
}

export function incrementSessionsCount(
  res: ResDetails,
  deviceType: DeviceType
) {
  // Getting today
  const today = getToday()

  // Getting reservation number and addons
  const resNumber = res.number
  const resAddons = res.addons

  function incrementSessions(
    key: string,
    addonMode: 'per-session' | 'per-day'
  ) {
    // Getting addon
    const addon = resAddons.find(
      (resAddon) => resAddon.type === deviceType && resAddon.mode === addonMode
    )

    // If addon exists
    if (addon) {
      // Getting today sessions count
      const keySessions = db().get<number>(key) || 0

      // It doesn't make sense to increment per-day if
      // we already incremented it today
      if (addonMode !== 'per-session' && keySessions > 0) {
        return true
      }

      // Checking if we can increment sessions count
      if (keySessions < addon.quantity) {
        // Expire in 1 week from departure date
        const expireIn =
          new Date(res.departureDate).getTime() - Date.now() + WEEK

        // Set incremented sessions count
        db().set(key, keySessions + 1, expireIn)

        // Return true
        return true
      }
    }
    return false
  }

  // First check per-session
  let incremented = incrementSessions(
    toKey('sessions', deviceType, resNumber, 'per-session'),
    'per-session'
  )
  if (incremented) {
    return
  }

  // Next check per-day
  incremented = incrementSessions(
    toKey('sessions', deviceType, resNumber, 'per-day', today),
    'per-day'
  )
  if (incremented) {
    return
  }

  // Finally check per-stay
  // this one doesn't require any checks
}
