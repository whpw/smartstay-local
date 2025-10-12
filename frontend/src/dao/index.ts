import type { AuthApi } from '@/routes/auth'
import type { AuthedApi } from '@/routes/authed'
import { hc } from 'hono/client'
import Cookies from 'universal-cookie'

const cookies = new Cookies(null, { path: '/' })

export const authClient = hc<AuthApi>('/api', {
  init: {
    credentials: 'include',
  },
})

export const authedClient = hc<AuthedApi>('/api', {
  init: {
    credentials: 'include',
  },
  fetch(input, requestInit, _Env, _executionCtx) {
    if (!cookies.get('_auth')) {
      location.href = '/login'
    }
    return fetch(input, requestInit)
  },
})
