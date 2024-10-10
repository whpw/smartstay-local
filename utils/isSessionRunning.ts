export function isSessionRunning(sessionEnd: number | null) {
    const remainingTime = sessionEnd ? sessionEnd - Date.now() : 0
    return remainingTime > 0
}
