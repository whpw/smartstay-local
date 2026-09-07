import { appConfig } from '@/config'
import type { DeviceType } from '@/config/types'
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
  untilDate: string,
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
          }),
        ),
      ) || 0
    return acc + sessions
  }, 0)
}

export function addonQuantity(
  addons: ResDetails['addons'],
  deviceType: DeviceType,
  addonMode: AddonMode,
) {
  return addons
    .filter((addon) => addon.type === deviceType && addon.mode === addonMode)
    .reduce((sum, addon) => sum + addon.quantity, 0)
}

function canStartToday(res: ResDetails, deviceType: DeviceType, today: string) {
  const resNumber = res.number
  const resAddons = res.addons

  const perSessionQty = addonQuantity(resAddons, deviceType, 'per-session')
  const perDayQty = addonQuantity(resAddons, deviceType, 'per-day')
  const perStayQty = addonQuantity(resAddons, deviceType, 'per-stay')

  if (perStayQty > 0) {
    return true
  }

  if (perSessionQty > 0) {
    const sessions =
      db().get<number>(
        toKey('sessions', deviceType, resNumber, 'per-session'),
      ) || 0
    if (sessions < perSessionQty) {
      return true
    }
  }

  if (perDayQty > 0) {
    const sessions =
      db().get<number>(
        toKey('sessions', deviceType, resNumber, 'per-day', today),
      ) || 0

    // If started today we can allow more sessions
    if (sessions > 0) {
      return true
    }

    const allSessions = getSessionsSum(res, deviceType, 'per-day', today)
    if (allSessions < perDayQty) {
      return true
    }
  }

  return false
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
      },
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
  deviceType: DeviceType,
) {
  // Getting today
  const today = getToday()

  // Getting reservation number and addons
  const resNumber = res.number
  const resAddons = res.addons

  function incrementSessions(
    key: string,
    addonMode: 'per-session' | 'per-day',
  ) {
    // Complimentary + paid of the same type+mode share one counter.
    // Complimentary entries are listed first, so the first N uses are free.
    const quantity = addonQuantity(resAddons, deviceType, addonMode)
    if (quantity <= 0) {
      return false
    }

    const keySessions = db().get<number>(key) || 0

    // It doesn't make sense to increment per-day if
    // we already incremented it today
    if (addonMode !== 'per-session' && keySessions > 0) {
      return true
    }

    if (keySessions < quantity) {
      const expireIn = new Date(res.departureDate).getTime() - Date.now() + WEEK
      db().set(key, keySessions + 1, expireIn)
      return true
    }
    return false
  }

  // First check per-session (complimentary quota is consumed before paid)
  let incremented = incrementSessions(
    toKey('sessions', deviceType, resNumber, 'per-session'),
    'per-session',
  )
  if (incremented) {
    return
  }

  // Next check per-day
  incremented = incrementSessions(
    toKey('sessions', deviceType, resNumber, 'per-day', today),
    'per-day',
  )
  if (incremented) {
    return
  }

  // Finally check per-stay
  // this one doesn't require any checks
}
