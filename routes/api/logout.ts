import { Handlers } from '$fresh/server.ts'
import { deleteCookie } from '$std/http/cookie.ts'
import { JWTData } from '@/model/jwt.ts'

export const handler: Handlers = {
    GET(_req, ctx) {
        // Getting the JWT data from the context
        const jwt = ctx.state.jwt as JWTData

        // Constructing the login URL
        const loginUrl = `${Deno.env.get('LOGIN_URL')}/${
            encodeURIComponent(jwt.res.number)
        }/${encodeURIComponent(jwt.res.lastName)}`

        const res = new Response(null, {
            status: 303,
            headers: {
                Location: loginUrl,
            },
        })

        deleteCookie(res.headers, 'jwt', {
            path: '/',
        })

        return res
    },
}
