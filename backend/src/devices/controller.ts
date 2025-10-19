import type { DeviceConfig } from '@/config'
import type { ResDetails } from '@/models/ResDetails'
import type { Action, DeviceViewData } from '@/models/ViewData'
import type { QueueMessage } from '@/queue'

export abstract class DeviceController {
  abstract get id(): string
  abstract get type(): string
  abstract init(config: DeviceConfig): Promise<void>
  abstract dispose(): void
  abstract get viewData(): DeviceViewData
  abstract processQueueMessage(msg: QueueMessage): Promise<void>
  abstract invokeAction(
    action: Action,
    res: ResDetails
  ): Promise<DeviceViewData | { error: string }>
  public async toggleEcoMode(_gap: number) {
    // Doing nothing
  }
}

export type JacuzziConfig = {
  sn: string
  totp: string
  thermostat: 'thermobox' | 'terneo'

  // Duration in minutes
  sessionDuration: number
  sessionTemp: number
  sessionHysteresis: number

  ecoTemp: number
  ecoHysteresis: number
  ecoModeTreshold: number

  idleTemp: number
  idleHysteresis: number
  minTemp: number
  maxTemp: number
} & DeviceConfig
