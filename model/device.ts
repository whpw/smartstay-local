export interface DeviceConfig {
    id: string
    name: string
    type: 'jacuzzi' | 'sauna' | 'thermostat'
}

export interface JacuzziConfig extends DeviceConfig {
    // Properties received from UDP broadcast
    hostname: string
    port: number
    transport: string
    hw: string
    cloud: 'true' | 'false'
    connection: string
    wifi: string
    display: string

    // Jacuzzi specific properties
    sessionDuration: number
    defaultTemperature: number
    maxTemperature: number
    minTemperature: number
    idleTemperature: number
    idleHysteresis: number
    activeHysteresis: number

    // Credentials for the device
    totp: string
    sn: string

    // State
    currentTemp: number
    targetTemp: number
    sessionEnd: number | null
}
