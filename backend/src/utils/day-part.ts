/**
 * Night lasts from `nightStart` (inclusive) until `dayStart` (exclusive) and
 * may cross midnight (e.g. 22 → 7). Equal hours mean there is no night.
 */
export function isNightHour(
  hour: number,
  dayStart: number,
  nightStart: number,
) {
  if (nightStart === dayStart) {
    return false
  }
  if (nightStart < dayStart) {
    return hour >= nightStart && hour < dayStart
  }
  return hour >= nightStart || hour < dayStart
}
