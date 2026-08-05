import { when } from 'mobx'

const DEFAULT_TIMEOUT_MS = 60_000

/** Wait until predicate is true, or reject after timeout so the queue can reschedule. */
export function waitUntilReady(
  predicate: () => boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return when(predicate, { timeout: timeoutMs })
}
