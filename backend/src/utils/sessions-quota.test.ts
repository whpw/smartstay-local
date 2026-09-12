import assert from 'node:assert/strict'
import type { AddonDTO } from '../models/ResDetails.ts'
import { JACUZZI_STOP_GRACE_MS } from '../models/ViewData.ts'
import {
  addonQuantity,
  complimentaryQuantity,
  isWithinStopGrace,
} from './sessions.ts'

const addons: AddonDTO[] = [
  { type: 'jacuzzi', mode: 'per-session', quantity: 1, complimentary: true },
  { type: 'jacuzzi', mode: 'per-session', quantity: 2 },
  { type: 'sauna', mode: 'per-stay', quantity: 1 },
]

assert.equal(addonQuantity(addons, 'jacuzzi', 'per-session'), 3)
assert.equal(addonQuantity(addons, 'jacuzzi', 'per-day'), 0)
assert.equal(addonQuantity(addons, 'sauna', 'per-stay'), 1)
assert.equal(addonQuantity([], 'jacuzzi', 'per-session'), 0)

assert.equal(complimentaryQuantity(addons, 'jacuzzi', 'per-session'), 1)
assert.equal(complimentaryQuantity(addons, 'sauna', 'per-stay'), 0)
assert.equal(complimentaryQuantity(addons, 'jacuzzi', 'per-day'), 0)

{
  const now = 1_000_000
  assert.equal(isWithinStopGrace(now - 30_000, now), true)
  assert.equal(isWithinStopGrace(now - JACUZZI_STOP_GRACE_MS + 1, now), true)
  assert.equal(isWithinStopGrace(now - JACUZZI_STOP_GRACE_MS, now), false)
  assert.equal(isWithinStopGrace(now - JACUZZI_STOP_GRACE_MS - 1, now), false)
}

console.log('sessions-quota.test.ts: ok')
