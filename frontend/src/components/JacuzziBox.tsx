import { Box, Slider, Stack } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import JacuzziStartButton from './JacuzziStartButton'

import { authedClient } from '@/dao'
import { isSessionRunning } from '@/utils/isSessionRunning'
import type { JacuzziViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { BoxContainer } from './BoxContainer'
import { UpsellModal } from './UpsellModal'

import jacuzziIcon from '@/assets/jacuzzi.png'
import { PollingErrorCover } from './PollingErrorCover'

export const JacuzziBox = ({ deviceId }: { deviceId: string }) => {
  // Translation
  const { t } = useTranslation()

  // View data
  const [viewData, setDeviceData] = useState<JacuzziViewData>()

  // Target temp
  const [targetTemp, setTargetTemp] = useState<number | undefined>(
    viewData?.targetTemp ? viewData.targetTemp : 0
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
      // Setting da
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

  // Calculating duration that is left
  const duration = useCallback(() => {
    return Math.max((viewData?.session?.endTime ?? 0) - Date.now(), 0)
  }, [viewData])

  // Checking if session is running
  const isRunning = isSessionRunning(viewData?.session?.endTime)

  const onConfirmedStartClick = () => {
    startSession()
  }

  // Checking if data is loaded
  if (!viewData) return <div>Loading...</div>

  return (
    <BoxContainer
      title={
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            gap: 1,
          }}>
          <Box component="img" src={jacuzziIcon} sx={{ width: 24 }} />
          <>{viewData.name}</>
        </Stack>
      }
      ctaButton={
        <JacuzziStartButton
          duration={duration()}
          isRunning={isRunning}
          viewData={viewData}
          onConfirmedStartClick={onConfirmedStartClick}
        />
      }
      currentTemp={
        viewData.state === 'initializing'
          ? t('devices.jacuzzi.initializing')
          : t('devices.jacuzzi.current-temp', {
              temp: viewData.currentTemp,
            })
      }
      targetTemp={t('devices.jacuzzi.target-temp', {
        temp: viewData.targetTemp,
      })}
    >
      {isRunning && (
        <Box>
          <Stack
            spacing={2}
            direction="row"
            sx={{ alignItems: 'center', mb: 2, px: 2 }}>
            <Slider
              aria-label={t('devices.jacuzzi.slider.title')}
              min={viewData.minTemp}
              max={viewData.maxTemp}
              value={targetTemp}
              disabled={viewData.pollingError}
              marks={[
                {
                  value: viewData.minTemp,
                  label: `${viewData.minTemp}°C`,
                },
                {
                  value: viewData.defaultTemp,
                  label: `${viewData.defaultTemp}°C`,
                },
                {
                  value: viewData.maxTemp,
                  label: `${viewData.maxTemp}°C`,
                },
              ]}
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setTargetTemp(value)
              }}
              onChangeCommitted={(_e, value) => {
                setTargetTemp(value)
                onTemperatureChange(value)
              }}
            />
          </Stack>
        </Box>
      )}

      {viewData.pollingError && <PollingErrorCover />}

      <UpsellModal
        open={upsellingModalOpen}
        handleClose={() => setUpsellingModalOpen(false)}
      />
    </BoxContainer>
  )
}
