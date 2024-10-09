import { FreshContext } from '$fresh/server.ts'
import { getCookies } from '$std/http/cookie.ts'
import { validateJwt } from '@/utils/jwt.ts'

export async function handler(
    req: Request,
    ctx: FreshContext,
) {
    if (ctx.destination !== 'route' || ctx.route.startsWith('/admin/login')) {
        return ctx.next()
    }

    // Getting JWT from cookies
    const cookies = getCookies(req.headers)

    if (
        !cookies._auth || !await validateJwt(cookies._auth).catch((error) => {
            console.error('Error validating admin JWT', error)
            return false
        })
    ) {
        return new Response('', {
            status: 307,
            headers: { Location: '/admin/login' },
        })
    }

    return await ctx.next()
}
