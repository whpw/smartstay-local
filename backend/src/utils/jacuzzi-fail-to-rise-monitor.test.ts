import assert from 'node:assert/strict'
import {
  FAIL_TO_RISE_COOLDOWN_MS,
  FAIL_TO_RISE_WINDOW_MS,
  JacuzziFailToRiseMonitor,
} from './jacuzzi-fail-to-rise-monitor.ts'

const MIN = 30
const monitor = new JacuzziFailToRiseMonitor()

function at(minutesAgo: number, from = Date.now()) {
  return from - minutesAgo * 60_000
}

{
  monitor.reset()
  const now = Date.now()
  // Only 10 minutes of history — should not alert
  monitor.observe(28, MIN, 0, at(10, now))
  const alert = monitor.observe(28, MIN, 0, now)
  assert.equal(alert, null, 'needs 30 minutes of history')
}

{
  monitor.reset()
  const now = Date.now()
  monitor.observe(28, MIN, 0, now - FAIL_TO_RISE_WINDOW_MS)
  // rose 1.5°C → OK
  const alert = monitor.observe(29.5, MIN, 0, now)
  assert.equal(alert, null, '1°C+ rise clears anomaly')
}

{
  monitor.reset()
  const now = Date.now()
  monitor.observe(28, MIN, 0, now - FAIL_TO_RISE_WINDOW_MS)
  const alert = monitor.observe(28.5, MIN, 0, now)
  assert.ok(alert, 'should alert when below min and rise < 1°C')
  assert.equal(alert.type, 'jacuzzi_fail_to_rise')
  assert.equal(alert.baselineTemp, 28)
  assert.equal(alert.currentTemp, 28.5)
  assert.equal(alert.floorTemp, 30)
  assert.equal(alert.hysteresis, 0)
}

{
  monitor.reset()
  const now = Date.now()
  monitor.observe(28, MIN, 0, now - FAIL_TO_RISE_WINDOW_MS)
  const first = monitor.observe(28, MIN, 0, now)
  assert.ok(first)
  const second = monitor.observe(28, MIN, 0, now + 60_000)
  assert.equal(second, null, 'cooldown suppresses repeat alerts')

  // Keep a trailing 30-minute history (as live polling would) across cooldown
  const later = now + FAIL_TO_RISE_COOLDOWN_MS + 1
  monitor.observe(28, MIN, 0, later - FAIL_TO_RISE_WINDOW_MS)
  const realert = monitor.observe(28, MIN, 0, later)
  assert.ok(realert, 're-alerts after cooldown while still stuck')
}

{
  monitor.reset()
  const now = Date.now()
  monitor.observe(29, MIN, 0, now - FAIL_TO_RISE_WINDOW_MS)
  // at/above min — no alert even if flat
  const alert = monitor.observe(30, MIN, 0, now)
  assert.equal(alert, null, 'at minTemp is not anomalous')
}

{
  monitor.reset()
  const now = Date.now()
  const hysteresis = 2
  // Within hysteresis band below minTemp (28–30 with idle hysteresis 2)
  monitor.observe(28.5, MIN, hysteresis, now - FAIL_TO_RISE_WINDOW_MS)
  const alert = monitor.observe(28.5, MIN, hysteresis, now)
  assert.equal(
    alert,
    null,
    'temp within hysteresis band below minTemp is not anomalous',
  )
}

{
  monitor.reset()
  const now = Date.now()
  const hysteresis = 2
  // Below floor (minTemp - hysteresis = 28)
  monitor.observe(27, MIN, hysteresis, now - FAIL_TO_RISE_WINDOW_MS)
  const alert = monitor.observe(27.2, MIN, hysteresis, now)
  assert.ok(alert, 'should alert when below hysteresis-adjusted floor')
  assert.equal(alert.floorTemp, 28)
  assert.equal(alert.hysteresis, 2)
  assert.equal(alert.minTemp, 30)
}

console.log('jacuzzi-fail-to-rise-monitor: ok')
