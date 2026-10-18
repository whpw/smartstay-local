import assert from 'node:assert/strict'
import { beforeEach, test, vi } from 'vitest'

const store = new Map<string, unknown>()

vi.mock('../db/index.ts', () => ({
  db: () => ({
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
  }),
  toKey: (...args: Array<string | number>) => args.join('/'),
}))
vi.mock('../config/index.ts', () => ({
  appConfig: { tz: 'Europe/Warsaw' },
}))

const { quotaDayOf, refundSessionQuota } = await import('./sessions.ts')

const res = {
  number: '100',
  departureDate: new Date(Date.now() + 3_600_000).toISOString(),
}

beforeEach(() => store.clear())

test('quotaDayOf uses the object time zone', () => {
  // 23:30 UTC on 17 Oct is 01:30 on 18 Oct in Warsaw (CEST)
  assert.equal(quotaDayOf(Date.parse('2026-10-17T23:30:00Z')), '2026-10-18')
  assert.equal(quotaDayOf(Date.parse('2026-10-17T20:30:00Z')), '2026-10-17')
})

test('a per-day refund decrements the day that was consumed', () => {
  store.set('sessions/jacuzzi/100/per-day/2026-10-17', 1)
  store.set('sessions/jacuzzi/100/per-day/2026-10-18', 1)
  refundSessionQuota(res, 'jacuzzi', 'per-day', '2026-10-17')
  assert.equal(store.get('sessions/jacuzzi/100/per-day/2026-10-17'), 0)
  assert.equal(store.get('sessions/jacuzzi/100/per-day/2026-10-18'), 1)
})

test('a per-session refund ignores the day', () => {
  store.set('sessions/jacuzzi/100/per-session', 2)
  refundSessionQuota(res, 'jacuzzi', 'per-session', '2026-10-17')
  assert.equal(store.get('sessions/jacuzzi/100/per-session'), 1)
})
