import { appConfig } from '@/config'
import type { DeviceType } from '@/config/types'
import { db, toKey } from '@/db'
import type { AddonMode, ResDetails } from '@/models/ResDetails'
import type { JacuzziSessionQuotaMode } from '@/models/ViewData'
import { JACUZZI_STOP_GRACE_MS } from '@/models/ViewData'
import { getResDetails } from '@/reservations'
import { TZDate } from '@date-fns/tz'
import { eachDayOfInterval, formatISO } from 'date-fns'
import { logger } from './logger'

const WEEK = 60 * 60 * 24 * 7

export type SessionQuotaMeta = {
  complimentary: boolean
  refundableMode: JacuzziSessionQuotaMode | null
}

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

export function complimentaryQuantity(
  addons: ResDetails['addons'],
  deviceType: DeviceType,
  addonMode: AddonMode,
) {
  return addons
    .filter(
      (addon) =>
        addon.type === deviceType &&
        addon.mode === addonMode &&
        addon.complimentary,
    )
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
): SessionQuotaMeta {
  // Getting today
  const today = getToday()

  // Getting reservation number and addons
  const resNumber = res.number
  const resAddons = res.addons

  function incrementSessions(
    key: string,
    addonMode: JacuzziSessionQuotaMode,
    usedBefore: number,
  ): SessionQuotaMeta | null {
    // Complimentary + paid of the same type+mode share one counter.
    // Complimentary entries are listed first, so the first N uses are free.
    const quantity = addonQuantity(resAddons, deviceType, addonMode)
    if (quantity <= 0) {
      return null
    }

    const keySessions = db().get<number>(key) || 0

    // It doesn't make sense to increment per-day if
    // we already incremented it today
    if (addonMode !== 'per-session' && keySessions > 0) {
      return { complimentary: false, refundableMode: null }
    }

    if (keySessions < quantity) {
      const expireIn = new Date(res.departureDate).getTime() - Date.now() + WEEK
      db().set(key, keySessions + 1, expireIn)
      const complimentary =
        usedBefore < complimentaryQuantity(resAddons, deviceType, addonMode)
      return { complimentary, refundableMode: addonMode }
    }
    return null
  }

  // First check per-session (complimentary quota is consumed before paid)
  const perSessionKey = toKey('sessions', deviceType, resNumber, 'per-session')
  const perSessionBefore = db().get<number>(perSessionKey) || 0
  let meta = incrementSessions(perSessionKey, 'per-session', perSessionBefore)
  if (meta) {
    return meta
  }

  // Next check per-day
  const perDayKey = toKey('sessions', deviceType, resNumber, 'per-day', today)
  const perDayUsedBefore = getSessionsSum(res, deviceType, 'per-day', today)
  meta = incrementSessions(perDayKey, 'per-day', perDayUsedBefore)
  if (meta) {
    return meta
  }

  // Finally check per-stay - unlimited, nothing to refund
  return {
    complimentary: complimentaryQuantity(resAddons, deviceType, 'per-stay') > 0,
    refundableMode: null,
  }
}

export function refundSessionQuota(
  res: ResDetails,
  deviceType: DeviceType,
  refundableMode: JacuzziSessionQuotaMode,
) {
  const today = getToday()
  const key =
    refundableMode === 'per-session'
      ? toKey('sessions', deviceType, res.number, 'per-session')
      : toKey('sessions', deviceType, res.number, 'per-day', today)

  const current = db().get<number>(key) || 0
  if (current <= 0) {
    return
  }

  const expireIn = new Date(res.departureDate).getTime() - Date.now() + WEEK
  db().set(key, current - 1, expireIn)
}

export function isWithinStopGrace(startTime: number, now = Date.now()) {
  return now - startTime < JACUZZI_STOP_GRACE_MS
}
