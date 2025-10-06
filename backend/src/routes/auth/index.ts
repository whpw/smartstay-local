import { getResDetails, isResDetails } from '@/utils/getResDetails'
import { zValidator } from '@hono/zod-validator'
import { differenceInSeconds } from 'date-fns'
import { Hono } from 'hono'
import { setSignedCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'
import { z } from 'zod'

const api = new Hono().post(
  '/login',
  zValidator(
    'json',
    z.object({
      resNumber: z.string(),
      lastName: z.string(),
    })
  ),
  async (c) => {
    // Destructuring data
    const { resNumber, lastName } = c.req.valid('json')

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
      }
    )

    // Handling errors
    if (!isResDetails(resDetails)) {
      if ('code' in resDetails) {
        return c.json(resDetails, 400)
      }
      return c.json(
        {
          code: 'login.unknown',
        },
        400
      )
    }

    const signed = await sign(
      {
        exp: differenceInSeconds(resDetails.departureDate, 0),
        user: resDetails.email,
        role: 'user',
        payload: resDetails,
      },
      'jwt-secret',
      'HS256'
    )

    await setSignedCookie(c, '_auth', signed, 'cookie-secret', {
      expires: new Date(resDetails.departureDate),
      httpOnly: false,
    })

    return c.json({ isAuthed: true }, 200)
  }
)

export { api }

export type AuthApi = typeof api
