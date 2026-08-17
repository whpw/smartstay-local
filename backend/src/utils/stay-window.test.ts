import assert from 'node:assert/strict'
import {
  dateAtHourInTimeZone,
  isStayActive,
  parseHotresDate,
  stayWindow,
} from './stay-window.ts'

{
  const instant = dateAtHourInTimeZone(2026, 8, 17, 15, 'Europe/Warsaw')
  assert.equal(
    instant.toISOString(),
    '2026-08-17T13:00:00.000Z',
    '15:00 Europe/Warsaw in summer is 13:00 UTC (CEST)',
  )
}

{
  const instant = dateAtHourInTimeZone(2026, 1, 12, 15, 'Europe/Warsaw')
  assert.equal(
    instant.toISOString(),
    '2026-01-12T14:00:00.000Z',
    '15:00 Europe/Warsaw in winter is 14:00 UTC (CET)',
  )
}

{
  const instant = dateAtHourInTimeZone(2026, 8, 17, 15, 'UTC')
  assert.equal(instant.toISOString(), '2026-08-17T15:00:00.000Z')
}

{
  const window = stayWindow('2026-08-17', '2026-08-21', 15, 11, 'Europe/Warsaw')
  assert.ok(window)
  assert.equal(window.start.toISOString(), '2026-08-17T13:00:00.000Z')
  assert.equal(window.end.toISOString(), '2026-08-21T09:00:00.000Z')
}

const checkinHour = 15
const checkoutHour = 11

{
  // 16:27 CEST = 14:27 UTC — after local 15:00 check-in, before UTC 15:00
  const now = new Date('2026-08-17T14:27:00.000Z')
  assert.equal(
    isStayActive(
      '2026-08-17',
      '2026-08-21',
      checkinHour,
      checkoutHour,
      now,
      'Europe/Warsaw',
    ),
    true,
    'guest at 14:27 UTC on arrival day is inside Warsaw check-in',
  )
  assert.equal(
    isStayActive(
      '2026-08-17',
      '2026-08-21',
      checkinHour,
      checkoutHour,
      now,
      'UTC',
    ),
    false,
    'same instant is still before 15:00 UTC check-in',
  )
}

{
  // 14:59 CEST = 12:59 UTC — before local 15:00 check-in
  const now = new Date('2026-08-17T12:59:00.000Z')
  assert.equal(
    isStayActive(
      '2026-08-17',
      '2026-08-21',
      checkinHour,
      checkoutHour,
      now,
      'Europe/Warsaw',
    ),
    false,
  )
}

{
  // 11:30 CEST = 09:30 UTC — after local 11:00 checkout
  const now = new Date('2026-08-21T09:30:00.000Z')
  assert.equal(
    isStayActive(
      '2026-08-17',
      '2026-08-21',
      checkinHour,
      checkoutHour,
      now,
      'Europe/Warsaw',
    ),
    false,
  )
}

{
  assert.deepEqual(parseHotresDate('2026-08-17 00:00:00'), {
    year: 2026,
    month: 8,
    day: 17,
  })
}

console.log('stay-window tests passed')
