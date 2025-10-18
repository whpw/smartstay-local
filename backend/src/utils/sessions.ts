import { getResDetails } from '@/reservations'

import { db, toKey } from '@/db'
import type { AddonDTO, ResDetails } from '@/models/ResDetails'

const WEEK = 60 * 60 * 24 * 7

function checkAddons(
  resAddons: Array<AddonDTO>,
  deviceType: string,
  resNumber: string,
  day: string
) {
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
          const sessions =
            db().get<number>(
              toKey('sessions', deviceType, resNumber, 'per-day', day)
            ) || 0
          return sessions < addon.quantity
        }
        case 'per-stay': {
          // If per-stay is unlimited, return true
          return true
        }
      }
    })
    .some((result) => result)
}

export async function canStartSession(
  res: ResDetails,
  day: string,
  deviceType: string
) {
  const resNumber = res.number
  const resAddons = res.addons

  // Checking if session can be started
  const canStart = checkAddons(resAddons, deviceType, resNumber, day)

  // If session can't be started let's try reloading reservation addons
  if (!canStart) {
    // Getting new reservation details
    const resDetails = await getResDetails(res.number, res.lastName).catch(
      (error) => {
        console.error('Error getting reservation details', error)
      }
    )

    // If we can't get reservation details, let's return true
    if (!resDetails) {
      return true
    }

    // Checking if session can be started
    return checkAddons(resDetails.addons, deviceType, resNumber, day)
  }

  return canStart
}

export async function incrementSessionsCount(
  res: ResDetails,
  day: string,
  deviceType: string
) {
  const resNumber = res.number
  const resAddons = res.addons

  async function incrementSessions(key: Array<string | number>) {
    const addon = resAddons.find(
      (resAddon) =>
        resAddon.type === deviceType && resAddon.mode === 'per-session'
    )
    if (addon) {
      const sessions = db().get<number>(toKey(...key)) || 0
      if (sessions < addon.quantity) {
        // Expire in 1 week from departure date
        const expireIn =
          new Date(res.departureDate).getTime() - Date.now() + WEEK
        // Set incremented sessions count
        await db().set(toKey(...key), sessions + 1, expireIn)
        return true
      }
    }
    return false
  }

  // First check per-session
  let incremented = await incrementSessions([
    'sessions',
    deviceType,
    resNumber,
    'per-session',
  ])
  if (incremented) {
    return
  }

  // Next check per-day
  incremented = await incrementSessions([
    'sessions',
    deviceType,
    resNumber,
    'per-day',
    day,
  ])
  if (incremented) {
    return
  }

  // Finally check per-stay
  // this one doesn't require any checks
}
