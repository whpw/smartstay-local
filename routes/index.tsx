import { FreshContext } from '$fresh/server.ts'
import { getDevices } from '@/devices/config.ts'
import { TerneoDevice } from '@/islands/TerneoDevice.tsx'
import { JWTData } from '@/model/jwt.ts'
import { StateWithI18n } from '@/utils/i18next-plugin.ts'

export default async function HomePage(
  _req: Request,
  ctx: FreshContext<StateWithI18n & { jwt: JWTData }>,
) {
  const devices = await getDevices()

  const i18n = ctx.state.i18n

  return (
    <div class='px-4 py-5 mx-auto'>
      <div class='max-w-screen-md mx-auto'>
        <div className='mb-7'>
          <img src='/logo.png' alt='logo image' className='w-32' />
        </div>
        <div className=''>
          {devices.map((device) => {
            if (device.type === 'jacuzzi') {
              return (
                <TerneoDevice
                  key={device.id}
                  device={device}
                  jwt={ctx.state.jwt}
                />
              )
            }
            return null
          })}
        </div>
      </div>
    </div>
  )
}
