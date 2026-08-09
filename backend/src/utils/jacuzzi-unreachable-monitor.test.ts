import assert from 'node:assert/strict'
import {
  JacuzziUnreachableMonitor,
  UNREACHABLE_COOLDOWN_MS,
  UNREACHABLE_THRESHOLD_MS,
} from './jacuzzi-unreachable-monitor.ts'

const monitor = new JacuzziUnreachableMonitor()

{
  monitor.reset()
  const now = Date.now()
  assert.equal(
    monitor.markFailure(now),
    null,
    'first failure should not alert immediately',
  )
  assert.equal(
    monitor.markFailure(now + UNREACHABLE_THRESHOLD_MS - 1),
    null,
    'below threshold should not alert',
  )
  const alert = monitor.markFailure(now + UNREACHABLE_THRESHOLD_MS)
  assert.ok(alert, 'should alert once sustained past threshold')
  assert.equal(alert.type, 'jacuzzi_unreachable')
}

{
  monitor.reset()
  const now = Date.now()
  monitor.markFailure(now)
  const first = monitor.markFailure(now + UNREACHABLE_THRESHOLD_MS)
  assert.ok(first)
  assert.equal(
    monitor.markFailure(now + UNREACHABLE_THRESHOLD_MS + 60_000),
    null,
    'cooldown suppresses repeat alerts',
  )
  const later = monitor.markFailure(
    now + UNREACHABLE_THRESHOLD_MS + UNREACHABLE_COOLDOWN_MS + 1,
  )
  assert.ok(later, 're-alerts after cooldown while still down')
}

{
  monitor.reset()
  const now = Date.now()
  monitor.markFailure(now)
  monitor.markFailure(now + UNREACHABLE_THRESHOLD_MS)
  monitor.markSuccess()
  assert.equal(
    monitor.markFailure(now + UNREACHABLE_THRESHOLD_MS + 10_000),
    null,
    'recovery resets the failure streak',
  )
  const alert = monitor.markFailure(
    now + UNREACHABLE_THRESHOLD_MS + 10_000 + UNREACHABLE_THRESHOLD_MS,
  )
  assert.ok(alert, 'new streak can alert again after recovery')
}

console.log('jacuzzi-unreachable-monitor: ok')
