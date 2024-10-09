import { FreshContext, Handlers, PageProps } from '$fresh/server.ts'
import { setCookie } from '$std/http/cookie.ts'
import { Alert } from '@/components/Alert.tsx'
import { StateWithI18n } from '@/utils/i18next-plugin.ts'
import { createJwt } from '@/utils/jwt.ts'

const HOUR = 60 * 60 * 1000

interface Data {
    error?: string
}

export const handler: Handlers<Data, StateWithI18n> = {
    async POST(req, ctx: FreshContext<StateWithI18n>) {
        const form = await req.formData()
        const pwd = form.get('password')?.toString()

        const { i18n } = ctx.state

        if (!pwd || pwd !== Deno.env.get('ADMIN_PASSWORD')) {
            return ctx.render({ error: i18n.t('admin.login.unauthorized') })
        }

        const expires = new Date(Date.now() + HOUR)
        const jwt = await createJwt({
            exp: expires.getTime() / 1000,
            admin: true,
        })

        const res = new Response(null, {
            status: 301,
            headers: { Location: '/admin' },
        })

        setCookie(res.headers, {
            name: '_auth',
            value: jwt,
            expires,
            sameSite: 'Strict',
        })

        return res
    },
}

export default function AdminLoginPage(props: PageProps<Data, StateWithI18n>) {
    const data = props.data
    const i18n = props.state.i18n

    return (
        <div className='px-4 py-8 mx-auto flex h-full w-full justify-center items-center'>
            <form method='post'>
                <div className='flex flex-col gap-2 w-80 pb-10'>
                    <div className='flex flex-row justify-center mb-10'>
                        <img src='/icon.png' alt='logo' />
                    </div>
                    {data?.error && <Alert type='error'>{data.error}</Alert>}
                    <div>
                        <input
                            type='password'
                            name='password'
                            placeholder={i18n.t('admin.login.password')}
                            required
                            className='input input-bordered w-full max-w-xs'
                        />
                    </div>
                    <button type='submit' className='btn mt-3'>
                        {i18n.t('admin.login.submit')}
                    </button>
                </div>
            </form>
        </div>
    )
}
