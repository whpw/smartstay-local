import {
  cancelPendingMessages,
  enqueueMessage,
  hasPendingMessage,
} from '@/queue'
import type { DeviceState } from '@/models'

type SessionLike = {
  endTime: number
}

export type ReconcileResult =
  | { status: 'expired' }
  | { status: 'active'; remainingMs: number }
  | { status: 'passthrough' }

/**
 * After loading persisted device state: decide whether to expire, keep active
 * (and ensure stop-session is queued), or leave non-active state alone.
 */
export function reconcileLoadedSession(opts: {
  deviceId: string
  state: DeviceState
  session: SessionLike | null
}): ReconcileResult {
  const { deviceId, state, session } = opts

  if (state === 'active' && !session) {
    return { status: 'expired' }
  }

  if (state !== 'active' || !session) {
    return { status: 'passthrough' }
  }

  const remainingMs = session.endTime - Date.now()

  if (remainingMs <= 0) {
    return { status: 'expired' }
  }

  if (!hasPendingMessage(deviceId, 'stop-session')) {
    enqueueMessage(
      {
        deviceId,
        action: 'stop-session',
        sessionEndTime: session.endTime,
      },
      remainingMs,
    )
  }

  return { status: 'active', remainingMs }
}

export function enqueueStopSession(
  deviceId: string,
  delayMs: number,
  sessionEndTime?: number,
) {
  cancelPendingMessages(deviceId, 'stop-session')
  enqueueMessage(
    {
      deviceId,
      action: 'stop-session',
      sessionEndTime,
    },
    Math.max(delayMs, 0),
  )
}

export function enqueueStopEco(deviceId: string, delayMs: number) {
  cancelPendingMessages(deviceId, 'stop-eco')
  enqueueMessage(
    {
      deviceId,
      action: 'stop-eco',
    },
    Math.max(delayMs, 0),
  )
}

/** True when a stop-session message still matches the current session. */
export function isStopMessageCurrent(
  msgSessionEndTime: number | undefined,
  currentEndTime: number | null | undefined,
) {
  if (msgSessionEndTime == null || currentEndTime == null) {
    return true
  }
  return msgSessionEndTime === currentEndTime
}
