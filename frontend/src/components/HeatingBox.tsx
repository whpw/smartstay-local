import heaterIcon from '@/assets/heater.png'
import { authedClient } from '@/dao'
import type { HeatingViewData } from '@/models'
import { Box, Button, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceCard, DeviceCardSkeleton } from './DeviceCard'
import { HeatingModal } from './HeatingModal'
import { PollingErrorCover } from './PollingErrorCover'

export const HeatingBox = ({ deviceId }: { deviceId: string }) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()

  const [editMode, setEditMode] = useState(false)

  const [viewData, setDeviceData] = useState<HeatingViewData>({
    state: 'initializing',
    name: '',
    currentTemp: 0,
    targetTemp: 0,
    dayTemp: 0,
    nightTemp: 0,
    minTemp: 0,
    maxTemp: 0,
    dayStart: 0,
    nightStart: 0,
    pollingError: false,
  })

  useEffect(() => {
    const evtSource = new EventSource(`/api/state/${deviceId}`, {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const receivedData = JSON.parse(event.data) as HeatingViewData
      setDeviceData(receivedData)
    })

    return () => {
      evtSource.close()
    }
  }, [deviceId])

  const { mutate: onTemperatureChange } = useMutation({
    mutationFn: async (value: { dayTemp: number; nightTemp: number }) => {
      return authedClient.action
        .$post({
          json: {
            deviceId,
            action: {
              type: 'SET_TARGET_TEMP',
              value,
            },
          },
        })
        .then(() => {
          enqueueSnackbar(t('devices.heating.update-success'), {
            variant: 'success',
          })
        })
        .catch((error) => {
          console.error('Error invoking action:', error)
          enqueueSnackbar(t('devices.heating.update-error'), {
            variant: 'error',
          })
        })
    },
  })

  // Weather monitoring sets `idle` when outdoor temp ≥ externalTempLimit.
  // Mirror jacuzzi/sauna idle UX: keep the live room temp as the hero value so
  // a weather shutdown does not look like a failed device init.
  const isIdle = viewData.state === 'idle'
  const isControllable = viewData.state === 'active' || viewData.state === 'eco'
  const initializing = viewData.state === 'initializing'

  if (initializing && !viewData.name) return <DeviceCardSkeleton />

  return (
    <DeviceCard
      icon={<Box component="img" src={heaterIcon} alt="" />}
      title={viewData.name}
      status={
        isIdle ? (
          <Typography variant="caption" color="text.secondary">
            {t('devices.heating.turned-off')}
          </Typography>
        ) : null
      }
      action={
        isControllable ? (
          <Button
            variant="contained"
            onClick={() => setEditMode(true)}
            disabled={viewData.pollingError}
          >
            {t('devices.heating.edit')}
          </Button>
        ) : undefined
      }
      currentTemp={
        !isControllable || viewData.currentTemp === viewData.targetTemp
          ? undefined
          : t('devices.now', { temp: viewData.currentTemp })
      }
      targetTemp={
        initializing
          ? undefined
          : isIdle
            ? viewData.currentTemp
            : viewData.targetTemp
      }
    >
      {viewData.pollingError && <PollingErrorCover />}

      <HeatingModal
        open={editMode}
        viewData={viewData}
        onClose={() => setEditMode(false)}
        onConfirm={(dayTemp, nightTemp) => {
          onTemperatureChange({ dayTemp, nightTemp })
          setEditMode(false)
        }}
      />
    </DeviceCard>
  )
}
