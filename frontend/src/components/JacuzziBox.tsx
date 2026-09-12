import { Box, Button, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import JacuzziStartButton from './JacuzziStartButton'

import { authedClient } from '@/dao'
import { formatRemaining } from '@/utils/formatRemaining'
import { isSessionRunning } from '@/utils/isSessionRunning'
import { JACUZZI_STOP_GRACE_MS, type JacuzziViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { AppDialog } from './AppDialog'
import { DeviceCard, DeviceCardSkeleton } from './DeviceCard'
import { UpsellModal } from './UpsellModal'

import jacuzziIcon from '@/assets/jacuzzi.png'
import { PollingErrorCover } from './PollingErrorCover'
import { TempSlider } from './TempSlider'

export const JacuzziBox = ({ deviceId }: { deviceId: string }) => {
  const { t } = useTranslation()

  const [viewData, setDeviceData] = useState<JacuzziViewData>()

  const [targetTemp, setTargetTemp] = useState<number | undefined>(
    viewData?.targetTemp ? viewData.targetTemp : 0,
  )

  const [upsellingModalOpen, setUpsellingModalOpen] = useState(false)
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false)

  const { mutate: startSession } = useMutation({
    mutationFn: async () => {
      const res = await authedClient.action.$post({
        json: {
          deviceId,
          action: {
            type: 'START',
          },
        },
      })
      return res.json()
    },
    onSuccess: (data) => {
      if ('error' in data && data.error === 'REACHED_LIMIT') {
        setUpsellingModalOpen(true)
        return
      }
      setDeviceData(data as JacuzziViewData)
    },
  })

  const { mutate: stopSession } = useMutation({
    mutationFn: async () => {
      const res = await authedClient.action.$post({
        json: {
          deviceId,
          action: {
            type: 'STOP',
          },
        },
      })
      return res.json()
    },
    onSuccess: (data) => {
      setStopConfirmOpen(false)
      setDeviceData(data as JacuzziViewData)
    },
  })

  useEffect(() => {
    const evtSource = new EventSource(`/api/state/${deviceId}`, {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const receivedData = JSON.parse(event.data) as JacuzziViewData
      setDeviceData(receivedData)
      setTargetTemp(receivedData.targetTemp)
    })

    return () => {
      evtSource.close()
    }
  }, [deviceId])

  const { mutate: onTemperatureChange } = useMutation({
    mutationFn: async (value: number) => {
      return authedClient.action.$post({
        json: {
          deviceId,
          action: {
            type: 'SET_TARGET_TEMP',
            value,
          },
        },
      })
    },
  })

  const duration = useCallback(() => {
    return Math.max((viewData?.session?.endTime ?? 0) - Date.now(), 0)
  }, [viewData])

  const isRunning = isSessionRunning(viewData?.session?.endTime)

  const onConfirmedStartClick = () => {
    startSession()
  }

  const onStopClick = () => {
    const session = viewData?.session
    if (!session) {
      return
    }
    const pastGrace = Date.now() - session.startTime >= JACUZZI_STOP_GRACE_MS
    if (pastGrace && session.complimentary) {
      setStopConfirmOpen(true)
      return
    }
    stopSession()
  }

  if (!viewData) return <DeviceCardSkeleton />

  const initializing = viewData.state === 'initializing'

  return (
    <DeviceCard
      active={isRunning}
      icon={<Box component="img" src={jacuzziIcon} alt="" />}
      title={viewData.name}
      status={
        initializing ? (
          <Typography variant="caption" color="text.secondary">
            {t('devices.jacuzzi.initializing')}
          </Typography>
        ) : isRunning ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            {t('devices.jacuzzi.ends-in', {
              time: formatRemaining(duration()),
            })}
          </Typography>
        ) : null
      }
      action={
        isRunning ? (
          <Button type="button" variant="outlined" onClick={onStopClick}>
            {t('devices.jacuzzi.stop')}
          </Button>
        ) : (
          <JacuzziStartButton
            isRunning={isRunning}
            viewData={viewData}
            onConfirmedStartClick={onConfirmedStartClick}
          />
        )
      }
      currentTemp={
        initializing || !isRunning
          ? undefined
          : t('devices.now', { temp: viewData.currentTemp })
      }
      targetTemp={
        initializing
          ? undefined
          : isRunning
            ? viewData.targetTemp
            : viewData.currentTemp
      }
    >
      {isRunning && (
        <TempSlider
          ariaLabel={t('devices.jacuzzi.slider.title')}
          min={viewData.minTemp}
          max={viewData.maxTemp}
          value={targetTemp}
          disabled={viewData.pollingError}
          defaultTemp={viewData.defaultTemp}
          onChange={setTargetTemp}
          onChangeCommitted={onTemperatureChange}
        />
      )}

      {viewData.pollingError && <PollingErrorCover />}

      <UpsellModal
        open={upsellingModalOpen}
        handleClose={() => setUpsellingModalOpen(false)}
      />

      <AppDialog
        open={stopConfirmOpen}
        onClose={() => setStopConfirmOpen(false)}
        title={t('devices.jacuzzi.stop-modal.title')}
        actions={
          <>
            <Button onClick={() => setStopConfirmOpen(false)}>
              {t('devices.jacuzzi.stop-modal.cancel')}
            </Button>
            <Button variant="contained" onClick={() => stopSession()}>
              {t('devices.jacuzzi.stop-modal.confirm')}
            </Button>
          </>
        }
      >
        <Typography color="text.secondary">
          {t('devices.jacuzzi.stop-modal.body')}
        </Typography>
      </AppDialog>
    </DeviceCard>
  )
}
