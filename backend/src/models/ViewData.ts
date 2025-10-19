export interface Action {
  type: string
  value?: unknown
}

export type DeviceState = 'initializing' | 'idle' | 'active' | 'eco'

export type DeviceViewData = {
  state: DeviceState
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
  currentTemp: string
  sessionDuration: number
}

export const SaunaActionType = {
  START: 'START',
  SET_TARGET_TEMP: 'SET_TARGET_TEMP',
}
