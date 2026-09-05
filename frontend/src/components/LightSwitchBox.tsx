import { deviceColors } from '@/theme'
import { Box, Button, Stack } from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import lightIcon from '@/assets/light.png'
import { authedClient } from '@/dao'
import { type SwitchBoxViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { DeviceCardSkeleton } from './DeviceCardSkeleton'
import { BoxContainer } from './BoxContainer'

export const LightSwitchBox = ({ deviceId }: { deviceId: string }) => {
  // Data state
  const [viewData, setViewData] = useState<SwitchBoxViewData>()

  const { t } = useTranslation()

  const { mutate: startSession, isPending } = useMutation({
    mutationFn: async (onOrOf: 'on' | 'off') => {
      const res = await authedClient.action.$post({
        json: {
          deviceId,
          action: {
            type: onOrOf === 'on' ? 'START' : 'STOP',
          },
        },
      })
      return res.json()
    },
    onSuccess: (data) => {
      setViewData(data as SwitchBoxViewData)
    },
  })

  useEffect(() => {
    const evtSource = new EventSource(`/api/state/${deviceId}`, {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const receivedData = JSON.parse(event.data)
      console.log('Received light switch state update:', receivedData)
      setViewData(receivedData as SwitchBoxViewData)
    })

    return () => {
      evtSource.close()
    }
  }, [deviceId])

  if (!viewData) return <DeviceCardSkeleton />

  return (
    <BoxContainer
      accent={deviceColors.light}
      title={
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            component="img"
            src={lightIcon}
            alt=""
            sx={{ width: 28, height: 28, objectFit: 'contain' }}
          />
          <>{viewData.name}</>
        </Stack>
      }
      ctaButton={
        <Button
          onClick={() =>
            startSession(viewData.state === 'active' ? 'off' : 'on')
          }
          disabled={
            viewData.pollingError ||
            viewData.state === 'initializing' ||
            isPending
          }
          variant={viewData.state === 'active' ? 'outlined' : 'contained'}
        >
          {viewData.state === 'active'
            ? t('devices.light-switch.off')
            : t('devices.light-switch.on')}
        </Button>
      }
      targetTemp={undefined}
      currentTemp={
        viewData.state === 'initializing'
          ? t('devices.light-switch.initializing')
          : ''
      }
    ></BoxContainer>
  )
}
