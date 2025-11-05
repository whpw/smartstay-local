import type { DeviceConfig } from '@/config'
import type { ResDetails } from '@/models/ResDetails'
import type { Action, DeviceViewData } from '@/models/ViewData'
import type { QueueMessage } from '@/queue'
import { createLogger } from '@/utils/logger'

export abstract class DevController<
  T extends DeviceConfig,
  V extends DeviceViewData
> {
  protected config: T

  protected logger: ReturnType<typeof createLogger>

  public get id(): string {
    return this.config.id
  }

  public get type(): string {
    return this.config.type
  }

  abstract init(): Promise<void>

  abstract dispose(): void

  abstract get viewData(): V

  abstract processQueueMessage(msg: QueueMessage): Promise<void>

  abstract invokeAction(
    action: Action,
    res: ResDetails
  ): Promise<V | { error: string }>

  public async toggleEcoMode(_gap: number) {
    // Doing nothing
  }

  constructor(config: T) {
    this.config = config
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

export type LightSwitchConfig = {
  sn: string
  sunsetMode: {
    turnOnShift: number // minutes
    turnOffAt: `${number}:${number}` // HH:MM
    ecoMode: boolean // should be disabled if true
  }
  sessionDuration: number // minutes
} & DeviceConfig

export type SaunaConfig = {
  // Duration in minutes
  sessionDuration: number
} & DeviceConfig
