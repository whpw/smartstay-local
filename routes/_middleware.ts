import { FreshContext } from '$fresh/server.ts'
import { getCookies, setCookie } from '$std/http/cookie.ts'
import { validateJwt } from '@/utils/jwt.ts'
import { toZonedTime } from 'date-fns-tz'

export async function handler(
    req: Request,
    ctx: FreshContext,
) {
    if (ctx.destination !== 'route' || ctx.route.startsWith('/admin')) {
        return ctx.next()
    }

    // Getting JWT from cookies
    const cookies = getCookies(req.headers)
    const url = new URL(req.url)
    const jwt = cookies.jwt || url.searchParams.get('jwt')

    if (jwt) {
        // Validate JWT
        const payload = await validateJwt(jwt).catch((error): undefined => {
            console.error('Error validating JWT', error)
            return undefined
        })

        // Token is valid we can let user in
        if (payload) {
            // Giving access to payload in ctx.state.jwt
            ctx.state.jwt = payload

            // Response object
            let res: Response

            if (url.searchParams.has('jwt')) {
                // Remove JWT from URL
                url.searchParams.delete('jwt')

                // Creating redirect response
                res = new Response('', {
                    status: 301,
                    headers: { Location: url.toString() },
                })

                // Setting JWT in cookies
                setCookie(res.headers, {
                    name: 'jwt',
                    value: jwt,
                    expires: toZonedTime(
                        (payload.exp && payload.exp * 1000) || new Date(),
                        'Europe/Warsaw',
                    ),
                })
            } else {
                // Continue to the route
                res = await ctx.next()
            }
            return res
        }
    }

    // Either no JWT or invalid JWT
    return Response.redirect(
        `${Deno.env.get('AUTH_SERVICE_URL')}/login`,
    )
}
