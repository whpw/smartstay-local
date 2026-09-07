import assert from 'node:assert/strict'
import type { AddonDTO } from '../models/ResDetails.ts'
import { addonQuantity } from './sessions.ts'

const addons: AddonDTO[] = [
  { type: 'jacuzzi', mode: 'per-session', quantity: 1, complimentary: true },
  { type: 'jacuzzi', mode: 'per-session', quantity: 2 },
  { type: 'sauna', mode: 'per-stay', quantity: 1 },
]

assert.equal(addonQuantity(addons, 'jacuzzi', 'per-session'), 3)
assert.equal(addonQuantity(addons, 'jacuzzi', 'per-day'), 0)
assert.equal(addonQuantity(addons, 'sauna', 'per-stay'), 1)
assert.equal(addonQuantity([], 'jacuzzi', 'per-session'), 0)

console.log('sessions-quota.test.ts: ok')
