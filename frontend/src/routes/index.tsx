import { JacuzziBox } from '@/components/JacuzziBox'
import { authedClient } from '@/dao'
import { Stack } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { HeatingBox } from '../components/HeatingBox'
import { LightSwitchBox } from '../components/LightSwitchBox'
import { SaunaBox } from '../components/SaunaBox'

export const HomeRoute = () => {
  // Devices query
  const { data } = useQuery({
    queryKey: ['devices'],
    queryFn: () => authedClient.devices.$get().then((res) => res.json()),
    initialData: [],
  })

  return (
    <Stack
      spacing={2}
      sx={{
        alignItems: 'center',
        mb: 2,
      }}>
      {data.map((device) => {
        switch (device.type) {
          case 'sauna':
            return <SaunaBox key={device.id} deviceId={device.id} />
          case 'jacuzzi':
            return <JacuzziBox key={device.id} deviceId={device.id} />
          case 'heating':
            return <HeatingBox key={device.id} deviceId={device.id} />
          case 'light-switch':
            return <LightSwitchBox key={device.id} deviceId={device.id} />
          default:
            return null
        }
      })}
    </Stack>
  )
}
