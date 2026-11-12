import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResDetails } from '../models/ResDetails'

const store = new Map<string, number>()
const getResDetails = vi.fn()

vi.mock('../config/index.ts', () => ({ appConfig: { tz: 'Europe/Warsaw' } }))
vi.mock('../db/index.ts', () => ({
  db: () => ({
    get: (key: string) => store.get(key),
    set: (key: string, value: number) => store.set(key, value),
  }),
  toKey: (...args: Array<string | number>) => args.join('/'),
}))
vi.mock('../reservations/index.ts', () => ({
  getResDetails: (...args: unknown[]) => getResDetails(...args),
}))

const { canStartSession, incrementSessionsCount, startDeniedError } =
  await import('./sessions')

const res = (overrides: Partial<ResDetails>): ResDetails => ({
  id: '1',
  number: '3678',
  email: 'a@b.pl',
  firstName: 'A',
  lastName: 'B',
  arrivalDate: '2026-11-11T14:00:00.000Z',
  departureDate: '2026-11-14T10:00:00.000Z',
  addonsUrl: '',
  addons: [],
  ...overrides,
})

const freeJacuzzi = {
  type: 'jacuzzi' as const,
  mode: 'per-session' as const,
  quantity: 1,
  complimentary: true,
}
const paidJacuzzi = {
  type: 'jacuzzi' as const,
  mode: 'per-stay' as const,
  quantity: 1,
}
const paidSauna = {
  type: 'sauna' as const,
  mode: 'per-stay' as const,
  quantity: 1,
}

describe('start with an unpaid balance', () => {
  beforeEach(() => {
    store.clear()
    getResDetails.mockReset()
  })

  it('allows paid addons when the reservation is settled', async () => {
    const fresh = res({ addons: [paidSauna], balanceDue: false })
    getResDetails.mockResolvedValue(fresh)
    const result = await canStartSession(res({}), 'sauna')
    expect(result.allowed).toBe(true)
  })

  it('does not ask Hotres when login data already allows the start', async () => {
    const cached = res({ addons: [paidSauna], balanceDue: false })
    const result = await canStartSession(cached, 'sauna')
    expect(result.allowed).toBe(true)
    expect(getResDetails).not.toHaveBeenCalled()
  })

  it('refuses a sauna added after login and not paid (reservation 3678)', async () => {
    // Login cookie: paid jacuzzi only, reservation settled
    const cached = res({ addons: [paidJacuzzi], balanceDue: false })
    getResDetails.mockResolvedValue(
      res({ addons: [paidJacuzzi, paidSauna], balanceDue: true }),
    )
    const result = await canStartSession(cached, 'sauna')
    expect(getResDetails).toHaveBeenCalledTimes(1)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('payment-due')
    expect(startDeniedError(result)).toBe('PAYMENT_DUE')
  })

  it('allows after the guest pays: stale balance triggers a fresh read', async () => {
    const cached = res({ addons: [paidSauna], balanceDue: true })
    getResDetails.mockResolvedValue(
      res({ addons: [paidSauna], balanceDue: false }),
    )
    const result = await canStartSession(cached, 'sauna')
    expect(getResDetails).toHaveBeenCalledTimes(1)
    expect(result.allowed).toBe(true)
  })

  it('still grants the one complimentary jacuzzi session', async () => {
    const fresh = res({
      addons: [freeJacuzzi, paidJacuzzi],
      balanceDue: true,
    })
    getResDetails.mockResolvedValue(fresh)

    expect((await canStartSession(fresh, 'jacuzzi')).allowed).toBe(true)
    expect(incrementSessionsCount(fresh, 'jacuzzi').complimentary).toBe(true)

    // The free session is used; the unpaid per-stay addon does not help
    const second = await canStartSession(fresh, 'jacuzzi')
    expect(second.allowed).toBe(false)
    expect(second.reason).toBe('payment-due')
  })

  it('reports a plain limit when nothing was bought', async () => {
    getResDetails.mockResolvedValue(res({ balanceDue: true }))
    const result = await canStartSession(res({}), 'sauna')
    expect(result.allowed).toBe(false)
    expect(startDeniedError(result)).toBe('REACHED_LIMIT')
  })

  it('keeps working when Hotres is unreachable', async () => {
    getResDetails.mockRejectedValue(new Error('down'))
    const result = await canStartSession(res({}), 'sauna')
    expect(result.allowed).toBe(true)
  })
})
