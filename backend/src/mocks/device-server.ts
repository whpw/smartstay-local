/**
 * Local HTTP mock for BleBox ThermoBox / SwitchBox and SaunaBox APIs.
 *
 * Start with: `pnpm -F @repo/backend mock:devices` (or via `pnpm dev:mock`).
 * Controllers discover via MOCK_DEVICES=1 (see `utils/device-api.ts`).
 */
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const PORT = Number(process.env.MOCK_DEVICES_PORT) || 9100
const HOST_IP = `127.0.0.1:${PORT}`

type ThermoBoxDevice = {
  kind: 'thermobox'
  thermo: { state: number; desiredTemp: number }
  sensors: Array<{
    id: number
    type: 'temperature'
    value: number
    state: number
  }>
}

type SwitchBoxDevice = {
  kind: 'switchbox'
  relays: Array<{ relay: number; state: 0 | 1 }>
}

type BleBoxDevice = ThermoBoxDevice | SwitchBoxDevice

type SaunaBoxState = {
  heatOn: boolean
  desiredTemp: number
  currentTemp: number
}

const DEFAULT_SNS = {
  thermobox: ['MOCKJAC', 'MOCKHEAT'] as const,
  switchbox: ['MOCKLSW'] as const,
}

const blebox = new Map<string, BleBoxDevice>()

const sauna: SaunaBoxState = {
  heatOn: false,
  desiredTemp: 8500,
  currentTemp: 4000,
}

function createThermoBox(initialTempC = 20): ThermoBoxDevice {
  const value = Math.round(initialTempC * 100)
  return {
    kind: 'thermobox',
    thermo: { state: 0, desiredTemp: value },
    sensors: [{ id: 0, type: 'temperature', value, state: 2 }],
  }
}

function createSwitchBox(): SwitchBoxDevice {
  return {
    kind: 'switchbox',
    relays: [{ relay: 0, state: 0 }],
  }
}

function seedDefaults() {
  for (const sn of DEFAULT_SNS.thermobox) {
    blebox.set(sn, createThermoBox(sn === 'MOCKJAC' ? 32 : 20))
  }
  for (const sn of DEFAULT_SNS.switchbox) {
    blebox.set(sn, createSwitchBox())
  }
}

function ensureBleBox(sn: string): BleBoxDevice {
  let device = blebox.get(sn)
  if (!device) {
    // Unknown SN: SwitchBox if it looks like the lights default, else ThermoBox.
    device =
      sn === 'MOCKLSW' || sn.toLowerCase().includes('light')
        ? createSwitchBox()
        : createThermoBox()
    blebox.set(sn, device)
  }
  return device
}

/** Nudge sensor temp toward desired when heat is on (request-driven). */
function tickThermo(device: ThermoBoxDevice) {
  const sensor = device.sensors[0]
  if (!sensor) return
  const target = device.thermo.desiredTemp
  const step = 50 // 0.5°C per poll
  if (device.thermo.state === 1) {
    if (sensor.value < target) {
      sensor.value = Math.min(sensor.value + step, target)
    } else if (sensor.value > target) {
      sensor.value = Math.max(sensor.value - step, target)
    }
  } else if (sensor.value > target) {
    sensor.value = Math.max(sensor.value - Math.floor(step / 2), target)
  }
}

function tickSauna() {
  const step = 100 // 1°C per poll
  if (sauna.heatOn) {
    if (sauna.currentTemp < sauna.desiredTemp) {
      sauna.currentTemp = Math.min(sauna.currentTemp + step, sauna.desiredTemp)
    } else if (sauna.currentTemp > sauna.desiredTemp) {
      sauna.currentTemp = Math.max(sauna.currentTemp - step, sauna.desiredTemp)
    }
  } else if (sauna.currentTemp > 2500) {
    sauna.currentTemp = Math.max(sauna.currentTemp - Math.floor(step / 2), 2500)
  }
}

seedDefaults()

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true, port: PORT }))

app.get('/blebox/:sn/info', (c) => {
  const sn = c.req.param('sn')
  ensureBleBox(sn)
  return c.json({
    device: {
      ip: `${HOST_IP}/blebox/${sn}`,
      id: sn,
    },
  })
})

app.get('/blebox/:sn/state', (c) => {
  const sn = c.req.param('sn')
  const device = ensureBleBox(sn)
  if (device.kind === 'thermobox') {
    tickThermo(device)
    return c.json({
      thermo: device.thermo,
      sensors: device.sensors,
    })
  }
  return c.json({ relays: device.relays })
})

app.post('/blebox/:sn/state', async (c) => {
  const sn = c.req.param('sn')
  const body = await c.req.json<{
    thermo?: { state?: number; desiredTemp?: number }
    relays?: Array<{ relay: number; state: 0 | 1 }>
  }>()

  let device = ensureBleBox(sn)

  if (body.relays) {
    if (device.kind !== 'switchbox') {
      device = createSwitchBox()
      blebox.set(sn, device)
    }
    for (const relay of body.relays) {
      const existing = device.relays.find((r) => r.relay === relay.relay)
      if (existing) {
        existing.state = relay.state
      } else {
        device.relays.push({ relay: relay.relay, state: relay.state })
      }
    }
    return c.json({ relays: device.relays })
  }

  if (device.kind !== 'thermobox') {
    device = createThermoBox()
    blebox.set(sn, device)
  }

  if (body.thermo) {
    if (typeof body.thermo.state === 'number') {
      device.thermo.state = body.thermo.state
    }
    if (typeof body.thermo.desiredTemp === 'number') {
      device.thermo.desiredTemp = body.thermo.desiredTemp
    }
  }

  return c.json({
    thermo: device.thermo,
    sensors: device.sensors,
  })
})

app.post('/blebox/:sn/api/settings/set', async (c) => {
  // Controllers POST hysteresis; accept and acknowledge.
  await c.req.json().catch(() => ({}))
  return c.json({ success: true })
})

app.get('/saunabox/api/device/state', (c) =>
  c.json({ device: { id: 'mock-sauna' } }),
)

app.get('/saunabox/s/t/:temp', (c) => {
  const temp = Number(c.req.param('temp'))
  if (Number.isFinite(temp)) {
    sauna.desiredTemp = temp
  }
  return c.json({ ok: true, desiredTemp: sauna.desiredTemp })
})

app.get('/saunabox/s/:onoff', (c) => {
  const onoff = c.req.param('onoff')
  sauna.heatOn = onoff === '1'
  return c.json({ ok: true, state: sauna.heatOn ? 1 : 0 })
})

app.get('/saunabox/api/heat/state', (c) => {
  tickSauna()
  return c.json({
    heat: {
      state: sauna.heatOn ? 1 : 0,
      desiredTemp: sauna.desiredTemp,
      sensors: [
        {
          id: 0,
          type: 'temperature',
          value: sauna.currentTemp,
          state: 2,
        },
      ],
    },
  })
})

console.log(`[mock-devices] listening on http://127.0.0.1:${PORT}`)
console.log(
  `[mock-devices] ThermoBox SNs: ${DEFAULT_SNS.thermobox.join(', ')} | SwitchBox: ${DEFAULT_SNS.switchbox.join(', ')} | SaunaBox: /saunabox`,
)

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' })
