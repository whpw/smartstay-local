import ky from 'ky'

export type RemoteAlertPayload = {
  ts: number
  type: string
  deviceId: string
  deviceName: string
  title: string
  body: string
  data?: Record<string, unknown>
}

function alertsUrlFromConfigApiUrl(configApiUrl: string) {
  if (configApiUrl.endsWith('/config')) {
    return `${configApiUrl.slice(0, -'/config'.length)}/alerts`
  }
  if (configApiUrl.endsWith('/config/')) {
    return `${configApiUrl.slice(0, -'/config/'.length)}/alerts`
  }
  return `${configApiUrl.replace(/\/$/, '')}/alerts`
}

/**
 * Best-effort push of a structured alert to the panel.
 * Failures are logged; callers should also write a local/remote log line.
 */
export async function pushRemoteAlert(
  alert: RemoteAlertPayload,
): Promise<boolean> {
  const configApiUrl = process.env.CONFIG_API_URL
  const apiKey = process.env.CONFIG_API_KEY
  if (!configApiUrl || !apiKey) {
    console.error('[remote-alerts] Missing CONFIG_API_URL or CONFIG_API_KEY')
    return false
  }

  const url = alertsUrlFromConfigApiUrl(configApiUrl)
  try {
    await ky.post(url, {
      json: { alerts: [alert] },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 15_000,
      retry: {
        limit: 2,
        methods: ['post'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      },
    })
    return true
  } catch (error) {
    console.error('[remote-alerts] Failed to push alert', error)
    return false
  }
}
