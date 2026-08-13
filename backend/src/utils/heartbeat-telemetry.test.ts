import assert from 'node:assert/strict'
import { collectHeartbeatTelemetry } from './heartbeat-telemetry.ts'

// Minimal fake controllers registry via module mock pattern: import after patch.
import { devices } from '@/devices'

const originalEntries = { ...devices }

for (const key of Object.keys(devices)) {
  delete devices[key]
}

devices['jac-1'] = {
  type: 'jacuzzi',
  viewData: {
    name: 'Jacuzzi',
    state: 'active',
    currentTemp: 36.5,
    targetTemp: 37,
    session: {
      targetTemp: 37,
      startTime: 1_000,
      endTime: 2_000,
    },
    pollingError: false,
    defaultTemp: 37,
    minTemp: 30,
    maxTemp: 39,
    sessionDuration: 150,
  },
} as (typeof devices)[string]

devices['heat-1'] = {
  type: 'heating',
  viewData: {
    name: 'Heating',
    state: 'idle',
  },
} as (typeof devices)[string]

const telemetry = collectHeartbeatTelemetry()

assert.equal(telemetry.devices.length, 1)
assert.equal(telemetry.devices[0]?.id, 'jac-1')
assert.equal(telemetry.devices[0]?.type, 'jacuzzi')
assert.equal(telemetry.devices[0]?.currentTemp, 36.5)
assert.equal(telemetry.devices[0]?.session?.targetTemp, 37)

for (const key of Object.keys(devices)) {
  delete devices[key]
}
Object.assign(devices, originalEntries)

console.log('heartbeat-telemetry.test.ts: ok')
