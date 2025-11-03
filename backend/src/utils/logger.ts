import debug from 'debug-logfmt'

const levels = ['debug', 'info', 'warn', 'error']

export const logger = debug('backend', {
  levels,
})

export function createLogger(ns: string) {
  return debug(ns, {
    levels,
  })
}
