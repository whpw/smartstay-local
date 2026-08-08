import debug from 'debug-logfmt'
import { appendRemoteLog, type RemoteLogLevel } from './remote-logger'

const levels = ['debug', 'info', 'warn', 'error'] as const
const remoteLevels = new Set<RemoteLogLevel>(['info', 'warn', 'error'])

type Logger = ReturnType<typeof debug>

function wrapLogger(ns: string, log: Logger): Logger {
  const handler: ProxyHandler<Logger> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (
        typeof prop === 'string' &&
        remoteLevels.has(prop as RemoteLogLevel) &&
        typeof value === 'function'
      ) {
        return (...args: unknown[]) => {
          appendRemoteLog(prop as RemoteLogLevel, ns, args)
          return (value as (...a: unknown[]) => unknown).apply(target, args)
        }
      }
      return value
    },
  }
  return new Proxy(log, handler)
}

export const logger = wrapLogger(
  'backend',
  debug('backend', {
    levels: [...levels],
  }),
)

export function createLogger(ns: string) {
  return wrapLogger(
    ns,
    debug(ns, {
      levels: [...levels],
    }),
  )
}
