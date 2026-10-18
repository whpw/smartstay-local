import assert from 'node:assert/strict'
import { beforeEach, test, vi } from 'vitest'
import type { ResDetails } from '../models/ResDetails.ts'

const store = new Map<string, unknown>()
const getResDetails = vi.fn()

vi.mock('../db/index.ts', () => ({
  db: () => ({
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
  }),
  toKey: (...args: Array<string | number>) => args.join('/'),
}))
vi.mock('../config/index.ts', () => ({
  appConfig: { hotresRoomId: 'room-1', tz: 'Europe/Warsaw' },
}))
vi.mock('../reservations/index.ts', () => ({
  getResDetails: (...args: unknown[]) => getResDetails(...args),
}))

const { canStartSession } = await import('./sessions.ts')
const { createAuthSession, getSessionReservation, refreshReservation } =
  await import('./auth-session.ts')

const reservation = (overrides: Partial<ResDetails> = {}): ResDetails => ({
  id: '1',
  number: '100',
  email: '',
  firstName: 'A',
  lastName: 'B',
  arrivalDate: new Date(Date.now() - 3_600_000).toISOString(),
  departureDate: new Date(Date.now() + 3_600_000).toISOString(),
  addons: [],
  addonsUrl: '',
  ...overrides,
})

beforeEach(() => {
  store.clear()
  getResDetails.mockReset()
})

test('a session id maps to the cached reservation until departure', () => {
  const res = reservation()
  const { id } = createAuthSession(res)
  assert.equal(getSessionReservation(id)?.number, '100')
  assert.equal(getSessionReservation('forged'), null)
  assert.equal(getSessionReservation(undefined), null)
})

test('an expired session is rejected', () => {
  const res = reservation({
    departureDate: new Date(Date.now() - 1000).toISOString(),
  })
  const { id } = createAuthSession(res)
  assert.equal(getSessionReservation(id), null)
})

test('a failed Hotres refresh never grants a paid add-on', async () => {
  getResDetails.mockRejectedValue(new Error('hotres down'))
  const result = await canStartSession(reservation(), 'sauna')
  assert.equal(result.allowed, false)
})

test('cached entitlements start without asking Hotres', async () => {
  const res = reservation({
    addons: [{ type: 'sauna', mode: 'per-stay', quantity: 1 }],
  })
  const result = await canStartSession(res, 'sauna')
  assert.equal(result.allowed, true)
  assert.equal(getResDetails.mock.calls.length, 0)
})

test('a refresh that finds a new add-on allows the start', async () => {
  const bought = reservation({
    addons: [{ type: 'sauna', mode: 'per-stay', quantity: 1 }],
  })
  getResDetails.mockResolvedValue(bought)
  const result = await canStartSession(reservation(), 'sauna')
  assert.equal(result.allowed, true)
})

test('concurrent refreshes share one Hotres request', async () => {
  let resolve!: (res: ResDetails) => void
  getResDetails.mockReturnValue(
    new Promise<ResDetails>((r) => {
      resolve = r
    }),
  )
  const res = reservation()
  const first = refreshReservation(res)
  const second = refreshReservation(res)
  resolve(res)
  await Promise.all([first, second])
  assert.equal(getResDetails.mock.calls.length, 1)
})
