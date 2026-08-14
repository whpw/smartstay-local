import { devices } from '@/devices'
import type { JacuzziViewData } from '@/models/ViewData'

export type JacuzziHeartbeatTelemetry = {
  id: string
  name: string
  type: 'jacuzzi'
  state: JacuzziViewData['state']
  currentTemp: number
  targetTemp: number
  session: JacuzziViewData['session']
  pollingError: boolean
}

export type HeartbeatTelemetry = {
  devices: JacuzziHeartbeatTelemetry[]
}

/** Snapshot jacuzzi view-data for the panel OTA heartbeat. */
export function collectHeartbeatTelemetry(): HeartbeatTelemetry {
  const jacuzzis: JacuzziHeartbeatTelemetry[] = []

  for (const [id, controller] of Object.entries(devices)) {
    if (controller.type !== 'jacuzzi') {
      continue
    }

    const view = controller.viewData as JacuzziViewData
    jacuzzis.push({
      id,
      name: view.name,
      type: 'jacuzzi',
      state: view.state,
      currentTemp: view.currentTemp,
      targetTemp: view.targetTemp,
      session: view.session,
      pollingError: view.pollingError,
    })
  }

  return { devices: jacuzzis }
}
