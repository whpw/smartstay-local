import { hc } from 'hono/client'
import type { AuthApi } from './routes/auth'
import type { AuthedApi } from './routes/authed'

export const authClient = hc<AuthApi>('/api', {
  init: {
    credentials: 'include',
  },
})

authClient

export const authedClient = hc<AuthedApi>('/api', {
  init: {
    credentials: 'include',
  },
})
