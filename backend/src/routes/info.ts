import { db } from '@/db'
import { Hono } from 'hono'

const api = new Hono().get('/info', async (c) => {
  const config = db().get<{ objectName: string }>('appConfig')
  return c.json(
    {
      objectName: config.objectName,
    },
    200
  )
})

export { api }

export type InfoApi = typeof api
