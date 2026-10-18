const SECRET_PARAMS = /([?&](?:apikey|auth|reservations_number)=)[^&\s]*/gi

/** Hotres errors carry the request URL (API key, auth code, reservation number). */
export function redactHotresError(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return text.replace(SECRET_PARAMS, '$1[redacted]')
}
