import z from 'zod'

export const $DeviceType = z.enum([
  'sauna',
  'jacuzzi',
  'heating',
  'light-switch',
])
export type DeviceType = z.infer<typeof $DeviceType>

export type DeviceConfig = {
  id: string
  type: DeviceType
  name: string
  disabled: boolean
}

export type AppConfig = {
  objectName: string
  apiKey: string
  weatherUrl: string
  sunsetUrl: string
  lat: number
  lng: number
  tz: string
  icalUrl: string
  checkinHour: number
  checkoutHour: number
  loginUrl: string
  hotresRoomId: string
  hotresAuthCode: string
  hotresApiKey: string
  hotresAddonsUrl: string
  devices: Array<DeviceConfig>
  wifi: {
    name: string
    ssid: string
    pwd: string
    ip: string
  }
}
