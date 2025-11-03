import type { DeviceConfig } from '@/config'
import type { ResDetails } from '@/models/ResDetails'
import type { Action, DeviceViewData } from '@/models/ViewData'
import type { QueueMessage } from '@/queue'
import { createLogger } from '@/utils/logger'

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

  protected logger: ReturnType<typeof createLogger>

  constructor() {
    this.logger = createLogger(this.constructor.name)
  }
}
export type JacuzziTerneoConfig = {
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

export type JacuzziConfig = {
  sn: string
  totp: string
  thermostat: 'thermobox' | 'terneo'

  // Duration in minutes
  sessionDuration: number

  idleHysteresis: number
  activeHysteresis: number

  lowTempDefault: number
  lowTempIdleDefault: number
  lowTempThreshold: number

  midTempDefault: number
  midTempIdleDefault: number
  midTempThreshold: number

  highTempDefault: number
  highTempIdleDefault: number

  ecoTemp: number
  ecoHysteresis: number
  ecoModeTreshold: number

  minTemp: number
  maxTemp: number
} & DeviceConfig

export type HeatingConfig = {
  sn: string
  thermostat: 'thermobox'
  dayStart: number
  nightStart: number
  dayTemp: number
  nightTemp: number
  ecoTemp: number
  ecoModeTreshold: number
  minTemp: number
  maxTemp: number
  externalTempLimit: number
} & DeviceConfig

export type SwitchBoxConfig = {
  sn: string
  sunsetMode: {
    turnOnShift: number // minutes
    turnOffAt: `${number}:${number}` // HH:MM
    ecoMode: boolean // should be disabled if true
  }
} & DeviceConfig
