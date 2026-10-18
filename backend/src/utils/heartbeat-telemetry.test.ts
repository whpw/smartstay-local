import { test, vi } from 'vitest'

import assert from 'node:assert/strict'
import { collectHeartbeatTelemetry } from './heartbeat-telemetry.ts'
import { devices } from '../devices/index.ts'

// Keep the physical device controllers out of the test.
vi.mock('../devices/index.ts', () => ({ devices: {} }))

test('heartbeat-telemetry regression checks', () => {
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
})
