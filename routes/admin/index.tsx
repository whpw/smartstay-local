import { FreshContext, Handlers, PageProps } from '$fresh/server.ts'
import { parse } from '$std/jsonc/mod.ts'
import { DeviceConfig } from '@/model/device.ts'
import { StateWithI18n } from '@/utils/i18next-plugin.ts'

interface Data {
    error?: string
    devices: DeviceConfig[]
}

const kv = await Deno.openKv()

export const handler: Handlers<Data, StateWithI18n> = {
    async POST(req, ctx: FreshContext<StateWithI18n>) {
        const form = await req.formData()

        const devices = parse(
            form.get('devices')?.toString() || '[]',
        ) as unknown as DeviceConfig[]

        if (!Array.isArray(devices)) {
            return ctx.render({ error: 'Invalid config' })
        }

        for (const device of devices) {
            await kv.set(['devices', device.id], device)
        }

        return ctx.render({ devices })
    },
    async GET(_req, ctx: FreshContext<StateWithI18n>) {
        const devicesRes = await kv.list<DeviceConfig>({
            prefix: ['devices'],
        })
        const devices = []
        for await (const device of devicesRes) {
            devices.push(device.value)
        }
        return ctx.render({ devices })
    },
}

export default function AdminPage(props: PageProps<Data, StateWithI18n>) {
    return (
        <div class='px-4 py-8 mx-auto'>
            <div class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
                <form method='post'>
                    <div>
                        <textarea
                            name='devices'
                            class='textarea h-64 w-96'
                            placeholder='Textarea'
                        >
                            {JSON.stringify(props.data.devices, null, 2)}
                        </textarea>
                    </div>
                    <div>
                        <input
                            type='submit'
                            class='btn btn-primary'
                            value='Zapisz'
                        />
                    </div>
                </form>
            </div>
        </div>
    )
}
