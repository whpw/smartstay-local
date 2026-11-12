import { describe, expect, it } from 'vitest'
import { hasBalanceDue } from './balance'

describe('hasBalanceDue', () => {
  it('is false when fully paid', () => {
    expect(hasBalanceDue(1296.76, 1296.76)).toBe(false)
    expect(hasBalanceDue(1296.76, '1296.76')).toBe(false)
  })

  it('is true when an addon was added after the last payment', () => {
    // Reservation 3678: sauna added, not paid
    expect(hasBalanceDue(1336.76, 1296.76)).toBe(true)
  })

  it('ignores float noise and overpayment', () => {
    expect(hasBalanceDue(100.001, 100)).toBe(false)
    expect(hasBalanceDue(100, 120)).toBe(false)
  })

  it('treats missing or malformed amounts as settled', () => {
    expect(hasBalanceDue(undefined, undefined)).toBe(false)
    expect(hasBalanceDue(100, null)).toBe(false)
    expect(hasBalanceDue('abc', 0)).toBe(false)
  })
})
