import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import dotenv from 'dotenv'
import { Hono } from 'hono'
import path, { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initConfig } from './config'
import { updateLocalIP } from './config/updateLocalIP'
import { initEcoMode } from './cron/ecoMode'
import { initSunset } from './cron/sunset'
import { initUpdateCheck } from './cron/updateCheck'
import { initWeather } from './cron/weather'
import { disposeDb } from './db'
import { devices, initDevices } from './devices'
import { disposeQueue, initQueue } from './queue'
import { api as authApi } from './routes/auth'
import { api as authedApi } from './routes/authed'
import { api as infoApi } from './routes/info'
import { logger } from './utils/logger'
import { startRemoteLogger, stopRemoteLogger } from './utils/remote-logger'
import { APP_VERSION } from './version'

// Loading env
dotenv.config({
  path: resolve('../../appdata/.env'),
})

// Start durable remote log shipper as early as possible
startRemoteLogger()

logger.info(`Starting smartstay-local ${APP_VERSION}`)

// Initializing config
await initConfig()

// Init sunset, weather & local IP
const [disposeSunset, disposeWeather] = await Promise.all([
  initSunset(),
  initWeather(),
  updateLocalIP(),
])

// Initializing devices
await initDevices()

// Initializing queue
initQueue()

// Init eco mode
const disposeEcoMode = initEcoMode()

// Room app OTA heartbeat (every 5 minutes)
const disposeUpdateCheck = initUpdateCheck()

const app = new Hono()

const isProd = process.env.NODE_ENV === 'production'

app.route('/api', infoApi)
app.route('/api', authApi)
app.route('/api', authedApi)

if (isProd) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const relativePathToScript = path.relative(process.cwd(), __dirname)
  app.use(
    '*',
    serveStatic({
      root: `${relativePathToScript}/../../frontend/dist`,
      index: 'index.html',
      rewriteRequestPath: (path) => {
        if (path === '/login') {
          return '/index.html'
        }
        return path
      },
    })
  )
}

const server = serve(
  {
    fetch: app.fetch,
    port: isProd ? 8080 : 8081,
    hostname: '0.0.0.0',
  },
  (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`)
  }
)

function shutdown(exitCode = 0) {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    logger.info('Server closed...')

    Object.values(devices).forEach((device) => {
      device.dispose()
    })

    if (disposeWeather) {
      disposeWeather()
    }

    if (disposeSunset) {
      disposeSunset()
    }

    if (disposeEcoMode) {
      disposeEcoMode()
    }

    if (disposeUpdateCheck) {
      disposeUpdateCheck()
    }

    disposeQueue()
    disposeDb()

    void stopRemoteLogger().finally(() => {
      process.exit(exitCode)
    })
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
