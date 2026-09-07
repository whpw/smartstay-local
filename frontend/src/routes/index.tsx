import { DeviceListSkeleton } from '@/components/DeviceCardSkeleton'
import { JacuzziBox } from '@/components/JacuzziBox'
import { authedClient } from '@/dao'
import { Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HeatingBox } from '../components/HeatingBox'
import { LightSwitchBox } from '../components/LightSwitchBox'
import { SaunaBox } from '../components/SaunaBox'

export const HomeRoute = () => {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => authedClient.devices.$get().then((res) => res.json()),
    initialData: [],
  })

  if (isLoading && data.length === 0) {
    return <DeviceListSkeleton count={3} />
  }

  if (data.length === 0) {
    return (
      <Typography
        variant="body1"
        color="text.secondary"
        align="center"
        sx={{ py: 4 }}
      >
        {t('devices.empty', { defaultValue: 'Brak dostępnych urządzeń' })}
      </Typography>
    )
  }

  return (
    <Stack
      spacing={2}
      sx={{
        alignItems: 'center',
        width: '100%',
      }}
    >
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
