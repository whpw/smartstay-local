import type { AuthApi } from '@/routes/auth'
import type { AuthedApi } from '@/routes/authed'
import type { InfoApi } from '@/routes/info'
import { hc } from 'hono/client'

export const infoClient = hc<InfoApi>('/api')

export const authClient = hc<AuthApi>('/api', {
  init: {
    credentials: 'include',
  },
})

export const authedClient = hc<AuthedApi>('/api', {
  init: {
    credentials: 'include',
  },
  async fetch(input, requestInit, _Env, _executionCtx) {
    const res = await fetch(input, requestInit)
    // The session cookie is HttpOnly, so an expired session shows up as 401
    if (res.status === 401 && location.pathname !== '/login') {
      location.href = '/login'
    }
    return res
  },
})
