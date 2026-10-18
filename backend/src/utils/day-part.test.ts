import { test } from 'vitest'
import assert from 'node:assert/strict'
import { isNightHour } from './day-part.ts'

test('isNightHour', () => {
  const hours = Array.from({ length: 24 }, (_, hour) => hour)
  const nightHours = (dayStart: number, nightStart: number) =>
    hours.filter((hour) => isNightHour(hour, dayStart, nightStart))

  // Default config: night crosses midnight
  assert.deepEqual(nightHours(7, 22), [0, 1, 2, 3, 4, 5, 6, 22, 23])

  // Night within one day
  assert.deepEqual(nightHours(6, 1), [1, 2, 3, 4, 5])

  // Equal hours: no night
  assert.deepEqual(nightHours(7, 7), [])
})
