import { appConfig } from '@/config'
import { db, toKey } from '@/db'
import type { ResDetails } from '@/models/ResDetails'
import { getResDetails } from '@/reservations'
import { randomBytes } from 'node:crypto'
import { logger } from './logger'

/** HttpOnly cookie holding a random session id; the data stays in the backend. */
export const SESSION_COOKIE = '_sid'

type AuthSession = {
  reservationNumber: string
  /** Hotres room the guest logged in to; a session never works in another room. */
  hotresRoomId: string
  expiresAt: number
}

const sessionKey = (id: string) => toKey('auth-session', id)
const reservationKey = (number: string) => toKey('reservation', number)

function msUntil(isoDate: string) {
  return new Date(isoDate).getTime() - Date.now()
}

/** Reservation data cached until the exact departure date and hour. */
export function cacheReservation(res: ResDetails) {
  const ttl = msUntil(res.departureDate)
  if (ttl > 0) {
    db().set(reservationKey(res.number), res, ttl)
  }
}

export function getCachedReservation(number: string): ResDetails | null {
  const res = db().get<ResDetails | undefined>(reservationKey(number))
  if (!res || msUntil(res.departureDate) <= 0) {
    return null
  }
  return res
}

export function createAuthSession(res: ResDetails) {
  cacheReservation(res)

  const id = randomBytes(32).toString('base64url')
  const session: AuthSession = {
    reservationNumber: res.number,
    hotresRoomId: appConfig.hotresRoomId,
    expiresAt: new Date(res.departureDate).getTime(),
  }
  db().set(sessionKey(id), session, session.expiresAt - Date.now())
  return { id, expires: new Date(session.expiresAt) }
}

/** Cached reservation of a valid session, or null (unknown, expired, other room). */
export function getSessionReservation(
  id: string | undefined,
): ResDetails | null {
  if (!id) {
    return null
  }
  const session = db().get<AuthSession | undefined>(sessionKey(id))
  if (
    !session ||
    session.expiresAt <= Date.now() ||
    session.hotresRoomId !== appConfig.hotresRoomId
  ) {
    return null
  }
  return getCachedReservation(session.reservationNumber)
}

const pendingRefreshes = new Map<string, Promise<ResDetails | null>>()

/**
 * Re-reads the reservation from Hotres and updates the cache. Concurrent
 * callers share one request. Resolves to null when Hotres fails or no longer
 * confirms the reservation; the cache is then left as it was.
 */
export function refreshReservation(res: ResDetails) {
  const pending = pendingRefreshes.get(res.number)
  if (pending) {
    return pending
  }

  const refresh = getResDetails(res.number, res.lastName)
    .then((fresh) => {
      cacheReservation(fresh)
      return fresh
    })
    .catch((error: unknown) => {
      logger.error('Error refreshing reservation details', error)
      return null
    })
    .finally(() => {
      pendingRefreshes.delete(res.number)
    })

  pendingRefreshes.set(res.number, refresh)
  return refresh
}
