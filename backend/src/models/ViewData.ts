export interface Action {
  type: string
  value?: unknown
}

export type DeviceState = 'initializing' | 'idle' | 'active' | 'eco'

export type DeviceViewData = {
  name: string
  state: DeviceState
}

/**
 * Heating types
 */

export type HeatingViewData = DeviceViewData & {
  currentTemp: number
  targetTemp: number
  dayStart: number
  nightStart: number
  dayTemp: number
  nightTemp: number
  minTemp: number
  maxTemp: number
  pollingError: boolean
}

export type HeatingPersistentState = {
  state: DeviceState
  dayTemp: number
  nightTemp: number
}

/**
 * Jacuzzi types
 */

export type JacuzziPersistentState = {
  state: DeviceState
  session: JacuzziSession | null
}

/** Early STOP within this window refunds the consumed session quota. */
export const JACUZZI_STOP_GRACE_MS = 2 * 60_000

export type JacuzziSessionQuotaMode = 'per-session' | 'per-day'

export type JacuzziSession = {
  targetTemp: number
  startTime: number
  endTime: number
  /** True when this start consumed a complimentary (free) entitlement slot. */
  complimentary?: boolean
  /**
   * Quota counter incremented for this start. Null when nothing was counted
   * (per-stay, or per-day already opened today). Used for grace-period refunds.
   */
  refundableMode?: JacuzziSessionQuotaMode | null
}

export type JacuzziViewData = DeviceViewData & {
  session: JacuzziSession | null
  currentTemp: number
  targetTemp: number
  defaultTemp: number
  minTemp: number
  maxTemp: number
  sessionDuration: number
  pollingError: boolean
}

export const JacuzziActionType = {
  START: 'START',
  STOP: 'STOP',
  SET_TARGET_TEMP: 'SET_TARGET_TEMP',
}

/**
 * Sauna types
 */

export type SaunaSession = {
  targetTemp: number
  startTime: number
  endTime: number
}

export type SaunaPersistentState = {
  state: DeviceState
  session: SaunaSession | null
}

export type SaunaViewData = DeviceViewData & {
  state: DeviceState
  session: SaunaSession | null
  currentTemp: number
  targetTemp: number
  defaultTemp: number
  minTemp: number
  maxTemp: number
  sessionDuration: number
  pollingError: boolean
  /** `manual` covers omitted / thermobox / minimal timer-only saunas. */
  thermostat: 'saunabox' | 'manual'
}

export const SaunaActionType = {
  START: 'START',
  STOP: 'STOP',
  SET_TARGET_TEMP: 'SET_TARGET_TEMP',
}

export type SwitchBoxViewData = DeviceViewData & {
  pollingError: boolean
  turnsOnAt?: Date
  turnsOffAt?: Date
}

export const SwitchBoxActionType = {
  START: 'START',
  STOP: 'STOP',
}
