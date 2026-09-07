import assert from 'node:assert/strict'
import type { AddonDTO } from '../models/ResDetails.ts'
import {
  normalizeComplimentaryAddons,
  resolveComplimentaryAddons,
} from './complimentary-addons.ts'

{
  assert.deepEqual(normalizeComplimentaryAddons(undefined), [])
  assert.deepEqual(normalizeComplimentaryAddons(null), [])
  assert.deepEqual(normalizeComplimentaryAddons({}), [])
  assert.deepEqual(normalizeComplimentaryAddons([]), [])
  assert.deepEqual(
    normalizeComplimentaryAddons([
      { type: 'sauna', mode: 'per-session', quantity: 1 },
      { type: 'jacuzzi', mode: 'per-session', quantity: 0 },
      { type: 'nope', mode: 'per-session', quantity: 1 },
    ]),
    [{ type: 'sauna', mode: 'per-session', quantity: 1 }],
  )
}

{
  const reservationAddons: AddonDTO[] = []
  const first = resolveComplimentaryAddons({
    reservationAddons,
    configured: [{ type: 'jacuzzi', mode: 'per-session', quantity: 1 }],
    previouslyGranted: [],
  })
  assert.deepEqual(first.addons, [
    { type: 'jacuzzi', mode: 'per-session', quantity: 1, complimentary: true },
  ])
  assert.deepEqual(first.grantsToPersist, [
    { type: 'jacuzzi', mode: 'per-session', quantity: 1 },
  ])

  const again = resolveComplimentaryAddons({
    reservationAddons,
    configured: [{ type: 'jacuzzi', mode: 'per-session', quantity: 1 }],
    previouslyGranted: first.grantsToPersist,
  })
  assert.deepEqual(again.addons, first.addons)
  assert.deepEqual(again.grantsToPersist, first.grantsToPersist)
}

{
  const result = resolveComplimentaryAddons({
    reservationAddons: [{ type: 'jacuzzi', mode: 'per-session', quantity: 2 }],
    configured: [{ type: 'jacuzzi', mode: 'per-session', quantity: 1 }],
    previouslyGranted: [],
  })
  assert.deepEqual(result.addons, [])
  assert.deepEqual(result.grantsToPersist, [])
}

{
  const result = resolveComplimentaryAddons({
    reservationAddons: [{ type: 'jacuzzi', mode: 'per-session', quantity: 2 }],
    configured: [
      { type: 'jacuzzi', mode: 'per-session', quantity: 1 },
      { type: 'sauna', mode: 'per-session', quantity: 1 },
    ],
    previouslyGranted: [],
  })
  assert.deepEqual(result.addons, [
    { type: 'sauna', mode: 'per-session', quantity: 1, complimentary: true },
  ])
}

{
  const result = resolveComplimentaryAddons({
    reservationAddons: [{ type: 'jacuzzi', mode: 'per-session', quantity: 2 }],
    configured: [{ type: 'jacuzzi', mode: 'per-session', quantity: 1 }],
    previouslyGranted: [{ type: 'jacuzzi', mode: 'per-session', quantity: 1 }],
  })
  assert.deepEqual(result.addons, [
    { type: 'jacuzzi', mode: 'per-session', quantity: 1, complimentary: true },
  ])
}

{
  const result = resolveComplimentaryAddons({
    reservationAddons: [],
    configured: [],
    previouslyGranted: [{ type: 'jacuzzi', mode: 'per-session', quantity: 1 }],
  })
  assert.deepEqual(result.addons, [])
  assert.deepEqual(result.grantsToPersist, [
    { type: 'jacuzzi', mode: 'per-session', quantity: 1 },
  ])
}

{
  const first = resolveComplimentaryAddons({
    reservationAddons: [],
    configured: [{ type: 'jacuzzi', mode: 'per-session', quantity: 1 }],
    previouslyGranted: [],
  })
  const later = resolveComplimentaryAddons({
    reservationAddons: [],
    configured: [
      { type: 'jacuzzi', mode: 'per-session', quantity: 1 },
      { type: 'sauna', mode: 'per-stay', quantity: 1 },
    ],
    previouslyGranted: first.grantsToPersist,
  })
  assert.deepEqual(later.addons, [
    { type: 'jacuzzi', mode: 'per-session', quantity: 1, complimentary: true },
    { type: 'sauna', mode: 'per-stay', quantity: 1, complimentary: true },
  ])
}

console.log('complimentary-addons.test.ts: ok')
