import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import dotenv from 'dotenv'
import { Hono } from 'hono'
import path, { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initConfig } from './config'
import { updateLocalIP } from './config/updateLocalIP'
import { ecoMode } from './cron/ecoMode'
import { initDevices } from './devices'
import { initQueue } from './queue'
import { api as authApi } from './routes/auth'
import { api as authedApi } from './routes/authed'

// Loading env
dotenv.config({
  path: resolve('../../appdata/.env'),
})

// Initializing config
const config = await initConfig()

// Updating local IP
await updateLocalIP(config.port)

// Initializing devices
await initDevices()

// Initializing queue
initQueue()

// Init eco mode
ecoMode()

const app = new Hono()

const isProd = process.env.NODE_ENV === 'production'

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
    console.log(`Server is running on http://localhost:${info.port}`)
  }
)

// graceful shutdown
process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server closed...')
    process.exit(0)
  })
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})
