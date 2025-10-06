import { config } from '@/config'
import { getDeviceController } from '@/devices'
import type { ResDetails } from '@/utils/ResDetails'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { contextStorage, getContext } from 'hono/context-storage'
import type { JwtVariables } from 'hono/jwt'
import { jwt } from 'hono/jwt'
import { streamSSE } from 'hono/streaming'
import { reaction } from 'mobx'
import { z } from 'zod'

export type AuthedEnv = {
  Variables: JwtVariables & {
    resDetails: ResDetails
  }
}

const app = new Hono<AuthedEnv>()
// JWT middleware
app.use(
  '/*',
  jwt({
    secret: 'jwt-secret',
    cookie: {
      key: '_auth',
      secret: 'cookie-secret',
    },
  })
)

// Context middleware
app.use(contextStorage())

// Set ResDetails
app.use((c, next) => {
  // Get ResDetails
  const jwtPayload = c.get('jwtPayload')

  // Set ResDetails
  c.set('resDetails', jwtPayload.payload)

  return next()
})

const api = app
  .post(
    '/action',
    zValidator(
      'json',
      z.object({
        deviceId: z.string(),
        action: z.object({
          type: z.enum(['START', 'STOP', 'SET_TARGET_TEMP']),
          value: z.union([z.number(), z.string()]).optional(),
        }),
      })
    ),
    async (c) => {
      const { deviceId, action } = c.req.valid('json')

      try {
        // Get controller
        const device = getDeviceController(deviceId)

        // Get ResDetails
        const resDetails = getContext<AuthedEnv>().get('resDetails')

        // Invoke action
        const result = await device.invokeAction(action, resDetails)

        // Return result
        return c.json(result, 200)
      } catch (error) {
        console.error('Error invoking action:', error)
        return c.json(
          {
            error: 'UNKNOWN_ERROR',
          },
          400
        )
      }
    }
  )

  // Devices
  .get('/devices', async (c) => {
    const devices = config.devices
    return c.json(devices, 200)
  })

  .get('/state/:deviceId', async (c) => {
    const deviceId = c.req.param('deviceId')
    const device = getDeviceController(deviceId)

    return streamSSE(c, async (stream) => {
      const disposer = reaction(
        () => device.viewData,
        (newState) => {
          stream.writeSSE({
            data: JSON.stringify(newState),
            event: 'device-state-update',
            id: crypto.randomUUID(),
          })
        },
        {
          fireImmediately: true,
        }
      )

      let aborted = false
      stream.onAbort(() => {
        aborted = true
        disposer()
      })

      while (!aborted) {
        await stream.sleep(1000)
      }
    })
  })

export { api }

export type AuthedApi = typeof api
