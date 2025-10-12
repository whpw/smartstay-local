import { JacuzziBox } from '@/components/JacuzziBox'
import { authedClient } from '@/dao'
import { Stack } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { SaunaBox } from '../components/SaunaBox'

export const HomeRoute = () => {
  // Devices query
  const { data } = useQuery({
    queryKey: ['devices'],
    queryFn: () => authedClient.devices.$get().then((res) => res.json()),
    initialData: [],
  })

  return (
    <Stack alignItems="center" spacing={2}>
      {data.map((device) => {
        if (device.type === 'sauna') {
          return <SaunaBox key={device.id} deviceId={device.id} />
        }
        if (device.type === 'jacuzzi') {
          return <JacuzziBox key={device.id} deviceId={device.id} />
        }
        return null
      })}
    </Stack>
  )
}
