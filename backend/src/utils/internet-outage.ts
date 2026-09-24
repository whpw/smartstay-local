const TEN_MIN_MS = 10 * 60 * 1000

type OutageState = {
  internetDownSince: number | null
  hotresDownSince: number | null
  ecoExitedForOutage: boolean
}

const initialState = (): OutageState => ({
  internetDownSince: null,
  hotresDownSince: null,
  ecoExitedForOutage: false,
})

let state = initialState()
let now = () => Date.now()
let onExtendedInternetOutage: (() => void) | null = null

export function setOutageClock(fn: () => number) {
  now = fn
}

export function resetOutageState() {
  state = initialState()
}

export function setExtendedInternetOutageHandler(handler: () => void) {
  onExtendedInternetOutage = handler
}

export function isInternetDown() {
  return state.internetDownSince != null
}

export function isExtendedOutage(at = now()) {
  if (
    state.internetDownSince != null &&
    at - state.internetDownSince >= TEN_MIN_MS
  ) {
    return true
  }
  if (
    state.hotresDownSince != null &&
    at - state.hotresDownSince >= TEN_MIN_MS
  ) {
    return true
  }
  return false
}

function maybeExitEco(at: number) {
  if (state.ecoExitedForOutage) {
    return
  }
  if (state.internetDownSince == null) {
    return
  }
  if (at - state.internetDownSince < TEN_MIN_MS) {
    return
  }
  state.ecoExitedForOutage = true
  onExtendedInternetOutage?.()
}

/** Heartbeat POST failed: the room cannot reach the panel. */
export function noteHeartbeatFailure(at = now()) {
  if (state.internetDownSince == null) {
    state.internetDownSince = at
  }
  maybeExitEco(at)
}

/** Heartbeat POST succeeded. `hotresDownSince` comes from the panel. */
export function noteHeartbeatSuccess(hotresDownSince: number | null) {
  state.internetDownSince = null
  state.hotresDownSince = hotresDownSince
  state.ecoExitedForOutage = false
}
