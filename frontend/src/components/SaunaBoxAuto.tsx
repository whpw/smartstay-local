import { Box, Button, Typography } from '@mui/material'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import SaunaStartButton from './SaunaStartButton'
import { UpsellModal } from './UpsellModal'

import saunaIcon from '@/assets/sauna.png'
import { authedClient } from '@/dao'
import { formatRemaining } from '@/utils/formatRemaining'
import { isSessionRunning } from '@/utils/isSessionRunning'
import type { SaunaViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { DeviceCard } from './DeviceCard'
import { PollingErrorCover } from './PollingErrorCover'
import { TempSlider } from './TempSlider'

export const SaunaBoxAuto = ({
  viewData,
  setViewData,
  deviceId,
}: {
  viewData: SaunaViewData
  setViewData: (data: SaunaViewData) => void
  deviceId: string
}) => {
  const { t } = useTranslation()

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
      setViewData(data as SaunaViewData)
      setTargetTemp((data as SaunaViewData).targetTemp)
    },
  })

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

  const { mutate: onStop } = useMutation({
    mutationFn: async () => {
      return authedClient.action.$post({
        json: {
          deviceId,
          action: {
            type: 'STOP',
          },
        },
      })
    },
  })

  const duration = useCallback(() => {
    return Math.max((viewData?.session?.endTime ?? 0) - Date.now(), 0)
  }, [viewData])

  const isRunning = isSessionRunning(viewData?.session?.endTime)
  const initializing = viewData.state === 'initializing'

  const onConfirmedStartClick = () => {
    startSession()
  }

  return (
    <DeviceCard
      active={isRunning}
      icon={<Box component="img" src={saunaIcon} alt="" />}
      title={viewData.name}
      status={
        initializing ? (
          <Typography variant="caption" color="text.secondary">
            {t('devices.sauna.initializing')}
          </Typography>
        ) : isRunning ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            {t('devices.sauna.ends-in', {
              time: formatRemaining(duration()),
            })}
          </Typography>
        ) : null
      }
      action={
        isRunning ? (
          <Button type="button" variant="outlined" onClick={() => onStop()}>
            {t('devices.sauna.stop')}
          </Button>
        ) : (
          <SaunaStartButton
            isRunning={isRunning}
            viewData={viewData}
            onConfirmedStartClick={onConfirmedStartClick}
            showDetailsAccordion={false}
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
          ariaLabel={t('devices.sauna.slider.title')}
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
