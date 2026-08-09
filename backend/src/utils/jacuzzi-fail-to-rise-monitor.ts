export const FAIL_TO_RISE_WINDOW_MS = 30 * 60 * 1000
export const FAIL_TO_RISE_MIN_C = 1
const SAMPLE_RETENTION_MS = FAIL_TO_RISE_WINDOW_MS + 5 * 60 * 1000
/** Re-alert at most once per cooldown while the condition persists. */
export const FAIL_TO_RISE_COOLDOWN_MS = 2 * 60 * 60 * 1000

export type TempSample = {
  ts: number
  temp: number
}

export type JacuzziFailToRiseAlert = {
  type: 'jacuzzi_fail_to_rise'
  ts: number
  currentTemp: number
  minTemp: number
  /** Effective floor after hysteresis: minTemp - hysteresis */
  floorTemp: number
  hysteresis: number
  baselineTemp: number
  riseC: number
  windowMinutes: number
}

/**
 * Detects: current temp is below (minTemp - hysteresis) and has not risen
 * by at least 1°C over the trailing 30-minute window.
 *
 * Hysteresis is applied because the thermostat only heats once temperature
 * drops that far below the set point; sitting within the band below minTemp
 * is expected, not an anomaly.
 */
export class JacuzziFailToRiseMonitor {
  private samples: TempSample[] = []
  private lastAlertAt = 0
  private alerting = false

  observe(
    temp: number,
    minTemp: number,
    hysteresis = 0,
    now = Date.now(),
  ): JacuzziFailToRiseAlert | null {
    this.samples.push({ ts: now, temp })
    this.prune(now)

    const safeHysteresis = Number.isFinite(hysteresis)
      ? Math.max(0, hysteresis)
      : 0
    const floorTemp = minTemp - safeHysteresis

    if (temp >= floorTemp) {
      this.alerting = false
      return null
    }

    const baselineTemp = this.baselineTemp(now)
    if (baselineTemp === null) {
      return null
    }

    const riseC = temp - baselineTemp
    if (riseC >= FAIL_TO_RISE_MIN_C) {
      this.alerting = false
      return null
    }

    if (this.alerting && now - this.lastAlertAt < FAIL_TO_RISE_COOLDOWN_MS) {
      return null
    }

    this.alerting = true
    this.lastAlertAt = now

    return {
      type: 'jacuzzi_fail_to_rise',
      ts: now,
      currentTemp: temp,
      minTemp,
      floorTemp,
      hysteresis: safeHysteresis,
      baselineTemp,
      riseC,
      windowMinutes: FAIL_TO_RISE_WINDOW_MS / 60_000,
    }
  }

  /** Most recent sample at or before (now - window). Null if history is too short. */
  private baselineTemp(now: number): number | null {
    const targetTs = now - FAIL_TO_RISE_WINDOW_MS
    if (this.samples.length === 0) {
      return null
    }

    const oldest = this.samples[0]!
    if (oldest.ts > targetTs) {
      return null
    }

    let baseline = oldest.temp
    for (const sample of this.samples) {
      if (sample.ts > targetTs) {
        break
      }
      baseline = sample.temp
    }
    return baseline
  }

  private prune(now: number) {
    const cutoff = now - SAMPLE_RETENTION_MS
    while (this.samples.length > 0 && this.samples[0]!.ts < cutoff) {
      this.samples.shift()
    }
  }

  /** Clears sample history and alert state (eco mode / tests). */
  reset() {
    this.samples = []
    this.lastAlertAt = 0
    this.alerting = false
  }
}
