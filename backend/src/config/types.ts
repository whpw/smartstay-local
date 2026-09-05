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
  /** Human-readable room name from the panel config payload. */
  roomName?: string
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
  hotresObjectId?: string
  hotresAddonsUrl: string
  /**
   * Addons granted once per reservation when Hotres does not already include
   * the same type+mode. Omit to use the default (1 jacuzzi session). Pass
   * `[]` to disable. Example sauna grant:
   * `{ "type": "sauna", "mode": "per-session", "quantity": 1 }`
   */
  complimentaryAddons?: Array<{
    type: DeviceType
    mode: 'per-session' | 'per-day' | 'per-stay'
    quantity: number
  }>
  devices: Array<DeviceConfig>
  wifi: {
    name: string
    ssid: string
    pwd: string
    ip: string
  }
}
