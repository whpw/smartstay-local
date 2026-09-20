import ky from 'ky'

export type RemoteGuestActionPayload = {
  ts: number
  reservationNumber: string
  reservationId?: string
  kind: 'login' | 'device'
  deviceId?: string
  deviceName?: string
  deviceType?: string
  actionType: 'LOGIN' | 'START' | 'STOP' | 'SET_TARGET_TEMP'
  actionValue?: number | string | { dayTemp: number; nightTemp: number } | null
  ok: boolean
  error?: string
}

export function actionsUrlFromConfigApiUrl(configApiUrl: string) {
  if (configApiUrl.endsWith('/config')) {
    return `${configApiUrl.slice(0, -'/config'.length)}/actions`
  }
  if (configApiUrl.endsWith('/config/')) {
    return `${configApiUrl.slice(0, -'/config/'.length)}/actions`
  }
  return `${configApiUrl.replace(/\/$/, '')}/actions`
}

/**
 * Best-effort push of structured guest stay actions to the panel.
 * Failures are logged; callers should not block the guest UX on this.
 */
export async function pushRemoteGuestActions(
  actions: RemoteGuestActionPayload[],
): Promise<boolean> {
  if (actions.length === 0) {
    return true
  }

  const configApiUrl = process.env.CONFIG_API_URL
  const apiKey = process.env.CONFIG_API_KEY
  if (!configApiUrl || !apiKey) {
    console.error(
      '[remote-guest-actions] Missing CONFIG_API_URL or CONFIG_API_KEY',
    )
    return false
  }

  // data: URLs are used for local mock config — skip remote ingest.
  if (configApiUrl.startsWith('data:')) {
    return false
  }

  const url = actionsUrlFromConfigApiUrl(configApiUrl)
  try {
    await ky.post(url, {
      json: { actions },
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
    console.error('[remote-guest-actions] Failed to push actions', error)
    return false
  }
}

export async function pushRemoteGuestAction(
  action: RemoteGuestActionPayload,
): Promise<boolean> {
  return pushRemoteGuestActions([action])
}
