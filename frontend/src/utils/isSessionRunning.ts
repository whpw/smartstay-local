export function isSessionRunning(sessionEnd?: number) {
  const remainingTime = sessionEnd ? sessionEnd - Date.now() : 0
  return remainingTime > 0
}
