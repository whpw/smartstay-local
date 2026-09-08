import { Box, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import JacuzziStartButton from './JacuzziStartButton'

import { authedClient } from '@/dao'
import { formatRemaining } from '@/utils/formatRemaining'
import { isSessionRunning } from '@/utils/isSessionRunning'
import type { JacuzziViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
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
        <JacuzziStartButton
          isRunning={isRunning}
          viewData={viewData}
          onConfirmedStartClick={onConfirmedStartClick}
        />
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
    </DeviceCard>
  )
}
