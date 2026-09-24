import assert from 'node:assert/strict'
import type { ResDetails } from '../models/ResDetails.ts'
import { canStartSession } from './sessions.ts'
import {
  isExtendedOutage,
  isInternetDown,
  noteHeartbeatFailure,
  noteHeartbeatSuccess,
  resetOutageState,
  setOutageClock,
} from './internet-outage.ts'

const TEN_MIN_MS = 10 * 60 * 1000
let clock = 0

setOutageClock(() => clock)

function at(ms: number) {
  clock = ms
}

const offlineRes = {
  id: 'offline-1',
  number: '1',
  email: '',
  firstName: '',
  lastName: 'Guest',
  arrivalDate: new Date(0).toISOString(),
  departureDate: new Date(0).toISOString(),
  addons: [],
  addonsUrl: '',
} satisfies ResDetails

async function main() {
  resetOutageState()
  at(0)
  noteHeartbeatFailure()
  assert.equal(isInternetDown(), true)
  assert.equal(isExtendedOutage(), false)

  at(TEN_MIN_MS - 1)
  noteHeartbeatFailure()
  assert.equal(isExtendedOutage(), false)

  at(TEN_MIN_MS)
  noteHeartbeatFailure()
  assert.equal(isExtendedOutage(), true)
  assert.equal((await canStartSession(offlineRes, 'sauna')).allowed, true)
  assert.equal((await canStartSession(offlineRes, 'jacuzzi')).allowed, true)

  noteHeartbeatSuccess(null)
  assert.equal(isInternetDown(), false)
  assert.equal(isExtendedOutage(), false)

  at(100_000)
  noteHeartbeatSuccess(100_000 - TEN_MIN_MS)
  assert.equal(isInternetDown(), false)
  assert.equal(isExtendedOutage(), true)
  assert.equal((await canStartSession(offlineRes, 'jacuzzi')).allowed, true)

  noteHeartbeatSuccess(100_000)
  assert.equal(isExtendedOutage(), false)

  resetOutageState()
  console.log('internet-outage.test.ts: ok')
}

await main()
