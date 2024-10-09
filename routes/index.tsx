import { FreshContext } from '$fresh/server.ts'
import { getDevices } from '@/devices/config.ts'
import { TerneoDevice } from '@/islands/TerneoDevice.tsx'
import { JWTData } from '@/model/jwt.ts'

export default async function HomePage(_req: Request, ctx: FreshContext) {
  const devices = await getDevices()

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
                  jwt={ctx.state.jwt as JWTData}
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
