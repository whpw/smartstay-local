import { Box, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'

import lightIcon from '@/assets/light.png'
import { authedClient } from '@/dao'
import { useDeviceViewData } from '@/utils/useDeviceStates'
import { type SwitchBoxViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { DeviceCard, DeviceCardSkeleton } from './DeviceCard'
import { PollingErrorCover } from './PollingErrorCover'

const ACTION_TIMEOUT_MS = 8_000

export const LightSwitchBox = ({ deviceId }: { deviceId: string }) => {
  const [viewData, setViewData] = useDeviceViewData<SwitchBoxViewData>(deviceId)

  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()

  const { mutate: startSession, isPending } = useMutation({
    mutationFn: async (onOrOf: 'on' | 'off') => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS)

      try {
        const res = await authedClient.action.$post(
          {
            json: {
              deviceId,
              action: {
                type: onOrOf === 'on' ? 'START' : 'STOP',
              },
            },
          },
          {
            init: {
              signal: controller.signal,
            },
          },
        )
        return res.json()
      } finally {
        clearTimeout(timeoutId)
      }
    },
    onSuccess: (data) => {
      if (data && typeof data === 'object' && 'error' in data) {
        enqueueSnackbar(t('devices.light-switch.action-error'), {
          variant: 'error',
        })
        return
      }

      setViewData(data as SwitchBoxViewData)
    },
    onError: () => {
      enqueueSnackbar(t('devices.light-switch.action-error'), {
        variant: 'error',
      })
    },
  })

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
          disabled={viewData.pollingError || initializing || isPending}
          loading={isPending}
          variant={isOn ? 'outlined' : 'contained'}
          sx={{ minWidth: 112 }}
        >
          {isOn ? t('devices.light-switch.off') : t('devices.light-switch.on')}
        </Button>
      }
    >
      {viewData.pollingError && <PollingErrorCover />}
    </DeviceCard>
  )
}
