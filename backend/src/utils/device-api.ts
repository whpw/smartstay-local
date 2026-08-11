/** Dev-only mock device HTTP server (see `src/mocks/device-server.ts`). */

export function isMockDevices(): boolean {
  const value = process.env.MOCK_DEVICES?.trim().toLowerCase()
  return value === '1' || value === 'true'
}

export function mockDevicesPort(): number {
  const parsed = Number(process.env.MOCK_DEVICES_PORT)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 9100
}

export function mockDevicesOrigin(): string {
  return `http://127.0.0.1:${mockDevicesPort()}`
}

/** BleBox mDNS discovery URL, or mock server path when MOCK_DEVICES is set. */
export function bleboxDiscoveryUrl(sn: string): string {
  if (isMockDevices()) {
    return `${mockDevicesOrigin()}/blebox/${encodeURIComponent(sn)}/info`
  }
  return `http://bbx-${sn}.local/info`
}

/** Build ky `prefix` from the IP string returned by `/info`. */
export function bleboxApiPrefixFromInfoIp(ip: string): string {
  return `http://${ip}`
}
