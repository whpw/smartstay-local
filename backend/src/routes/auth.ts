import { getResDetails, isResDetails } from '@/reservations'
import { createAuthSession, SESSION_COOKIE } from '@/utils/auth-session'
import { pushRemoteGuestAction } from '@/utils/remote-guest-actions'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'

const api = new Hono().post(
  '/login',
  zValidator(
    'json',
    z.object({
      resNumber: z.string(),
      lastName: z.string(),
    }),
  ),
  async (c) => {
    // Destructuring data
    const { resNumber, lastName } = await c.req.json()

    // Checking if there are any params
    const hasParams = resNumber && lastName
    if (!hasParams) {
      return c.json({ code: 'login.errorEmpty' }, 400)
    }

    // Getting reservation details
    const resDetails = await getResDetails(resNumber, lastName).catch(
      (error) => {
        console.error('Error getting reservation details', error)
        return error
      },
    )

    // Handling errors
    if (!isResDetails(resDetails)) {
      if ('code' in resDetails) {
        return c.json(resDetails, 401)
      }
      return c.json(
        {
          code: 'login.unknown',
        },
        401,
      )
    }

    // Session data stays in the backend; the cookie only carries its id
    const session = createAuthSession(resDetails)
    setCookie(c, SESSION_COOKIE, session.id, {
      path: '/',
      expires: session.expires,
      httpOnly: true,
      sameSite: 'Strict',
    })
    // Drop the pre-session JWT cookie, which is no longer accepted
    deleteCookie(c, '_auth', { path: '/' })

    void pushRemoteGuestAction({
      ts: Date.now(),
      reservationNumber: resDetails.number,
      reservationId: resDetails.id,
      kind: 'login',
      actionType: 'LOGIN',
      ok: true,
    })

    return c.json({ isAuthed: true }, 200)
  },
)

export { api }

export type AuthApi = typeof api
