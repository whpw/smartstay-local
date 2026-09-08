import { Box, Button } from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import lightIcon from '@/assets/light.png'
import { authedClient } from '@/dao'
import { type SwitchBoxViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { DeviceCard, DeviceCardSkeleton } from './DeviceCard'

export const LightSwitchBox = ({ deviceId }: { deviceId: string }) => {
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

  const isOn = viewData.state === 'active'
  const initializing = viewData.state === 'initializing'

  return (
    <DeviceCard
      active={isOn}
      icon={<Box component="img" src={lightIcon} alt="" />}
      title={viewData.name}
      status={
        initializing ? (
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            {t('devices.light-switch.initializing')}
          </Box>
        ) : null
      }
      action={
        <Button
          onClick={() => startSession(isOn ? 'off' : 'on')}
          disabled={viewData.pollingError || initializing}
          loading={isPending}
          variant={isOn ? 'outlined' : 'contained'}
          sx={{ minWidth: 112 }}
        >
          {isOn ? t('devices.light-switch.off') : t('devices.light-switch.on')}
        </Button>
      }
    />
  )
}
