import { TZDate } from '@date-fns/tz'
import { isWithinInterval } from 'date-fns'

const DEFAULT_TIME_ZONE = 'Europe/Warsaw'

function resolveTimeZone(timeZone: string | null | undefined): string {
  const trimmed = timeZone?.trim()
  if (!trimmed) {
    return DEFAULT_TIME_ZONE
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed })
    return trimmed
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export function parseHotresDate(value: string): {
  year: number
  month: number
  day: number
} | null {
  const ymd = value.trim().slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) {
    return null
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

/** Instant for a calendar date at `hour:00:00` in `timeZone`. */
export function dateAtHourInTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const h = Math.min(23, Math.max(0, Math.trunc(hour)))
  return new Date(
    new TZDate(year, month - 1, day, h, 0, 0, 0, timeZone).getTime(),
  )
}

export function stayWindow(
  arrivalDate: string,
  departureDate: string,
  checkinHour: number,
  checkoutHour: number,
  timeZone?: string | null,
): { start: Date; end: Date } | null {
  const arrival = parseHotresDate(arrivalDate)
  const departure = parseHotresDate(departureDate)
  if (!arrival || !departure) {
    return null
  }

  try {
    const zone = resolveTimeZone(timeZone)
    return {
      start: dateAtHourInTimeZone(
        arrival.year,
        arrival.month,
        arrival.day,
        checkinHour,
        zone,
      ),
      end: dateAtHourInTimeZone(
        departure.year,
        departure.month,
        departure.day,
        checkoutHour,
        zone,
      ),
    }
  } catch {
    return null
  }
}

export function isNowInStay(
  window: { start: Date; end: Date } | null,
  now: Date = new Date(),
): boolean {
  if (!window) {
    return false
  }
  try {
    return isWithinInterval(now, window)
  } catch {
    return false
  }
}

/**
 * Whether `now` is inside the stay window.
 *
 * Hotres arrival/departure are calendar dates (`Y-m-d`) with no timezone.
 * Check-in/out hours are interpreted in the property IANA timezone
 * (e.g. Europe/Warsaw), not the Node process local zone.
 */
export function isStayActive(
  arrivalDate: string | null,
  departureDate: string | null,
  checkinHour: number,
  checkoutHour: number,
  now: Date,
  timeZone?: string | null,
): boolean {
  if (!arrivalDate || !departureDate) {
    return false
  }

  return isNowInStay(
    stayWindow(arrivalDate, departureDate, checkinHour, checkoutHour, timeZone),
    now,
  )
}
