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

export type JacuzziSession = {
  targetTemp: number
  startTime: number
  endTime: number
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
