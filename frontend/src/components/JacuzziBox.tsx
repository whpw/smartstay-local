import { Box, Slider, Stack, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import JacuzziStartButton from './JacuzziStartButton'

import { authedClient } from '@/dao'
import { isSessionRunning } from '@/utils/isSessionRunning'
import type { JacuzziViewData } from '@backend/models'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useMutation } from '@tanstack/react-query'
import { UpsellModal } from './UpsellModal'

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
      return authedClient.action
        .$post({
          json: {
            deviceId,
            action: {
              type: 'START',
            },
          },
        })
        .then((res) => res.json())
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
    <>
      <Stack
        sx={{
          position: 'relative',
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          width: '100%',
          gap: 2,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6">{viewData.name}</Typography>
          <Typography variant="h6">
            {t('devices.jacuzzi.target-temp', { temp: viewData.targetTemp })}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <JacuzziStartButton
            duration={duration()}
            viewData={viewData}
            onConfirmedStartClick={onConfirmedStartClick}
          />
          <Box>
            <Typography variant="body2">
              {viewData.state !== 'initializing' &&
                t('devices.jacuzzi.current-temp', {
                  temp: viewData.currentTemp,
                })}
              {viewData.state === 'initializing' &&
                t('devices.jacuzzi.initializing')}
            </Typography>
          </Box>
        </Stack>
        {isRunning && (
          <Box>
            <Stack
              spacing={2}
              direction="row"
              sx={{ alignItems: 'center', mb: 2 }}
            >
              <Typography variant="body2">
                {viewData.minTemp}&nbsp;°C
              </Typography>
              <Slider
                aria-label={t('devices.jacuzzi.slider.title')}
                min={viewData.minTemp}
                max={viewData.maxTemp}
                value={targetTemp}
                disabled={viewData.pollingError}
                marks={[
                  {
                    value: viewData.defaultTemp,
                    label: `${viewData.defaultTemp}°C`,
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
              <Typography variant="body2">
                {viewData.maxTemp}&nbsp;°C
              </Typography>
            </Stack>
          </Box>
        )}
        {viewData.pollingError && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <ErrorOutlineIcon />
              <Typography variant="body2">
                {t('devices.jacuzzi.polling-error')}
              </Typography>
            </Stack>
          </Box>
        )}
      </Stack>
      <UpsellModal
        open={upsellingModalOpen}
        handleClose={() => setUpsellingModalOpen(false)}
      />
    </>
  )
}
