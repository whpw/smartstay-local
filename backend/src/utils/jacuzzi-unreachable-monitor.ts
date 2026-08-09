/** Continuous failure before the first alert (debounce brief network blips). */
export const UNREACHABLE_THRESHOLD_MS = 2 * 60 * 1000
/** Re-alert at most once per cooldown while still unreachable. */
export const UNREACHABLE_COOLDOWN_MS = 2 * 60 * 60 * 1000

export type JacuzziUnreachableAlert = {
  type: 'jacuzzi_unreachable'
  ts: number
  durationMs: number
  durationMinutes: number
}

/**
 * Detects sustained ThermoBox unreachability / polling failure.
 * Call markFailure on poll/discovery errors; markSuccess when the device responds.
 */
export class JacuzziUnreachableMonitor {
  private failureStartedAt: number | null = null
  private lastAlertAt = 0
  private alerting = false

  markSuccess() {
    this.failureStartedAt = null
    this.alerting = false
  }

  markFailure(now = Date.now()): JacuzziUnreachableAlert | null {
    if (this.failureStartedAt === null) {
      this.failureStartedAt = now
    }

    const durationMs = now - this.failureStartedAt
    if (durationMs < UNREACHABLE_THRESHOLD_MS) {
      return null
    }

    if (this.alerting && now - this.lastAlertAt < UNREACHABLE_COOLDOWN_MS) {
      return null
    }

    this.alerting = true
    this.lastAlertAt = now

    return {
      type: 'jacuzzi_unreachable',
      ts: now,
      durationMs,
      durationMinutes: Math.round(durationMs / 60_000),
    }
  }

  /** Test helper */
  reset() {
    this.failureStartedAt = null
    this.lastAlertAt = 0
    this.alerting = false
  }
}
