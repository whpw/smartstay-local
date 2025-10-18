import { Box, Slider, Stack, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import JacuzziStartButton from './JacuzziStartButton'

import { authedClient } from '@/dao'
import { isSessionRunning } from '@/utils/isSessionRunning'
import type { JacuzziViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { UpsellModal } from './UpsellModal'

export const JacuzziBox = ({ deviceId }: { deviceId: string }) => {
  // Translation
  const { t } = useTranslation()

  // Data state
  const [data, setData] = useState<JacuzziViewData>()

  const [targetTemp, setTargetTemp] = useState<number | undefined>(
    data?.targetTemp ? data.targetTemp : 0
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
      setData(data as JacuzziViewData)
    },
  })

  useEffect(() => {
    const evtSource = new EventSource(`/api/state/${deviceId}`, {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const receivedData = JSON.parse(event.data) as JacuzziViewData
      setData(receivedData)
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
    return Math.max((data?.session?.endTime ?? 0) - Date.now(), 0)
  }, [data])

  // Checking if session is running
  const isRunning = isSessionRunning(data?.session?.endTime)

  const onConfirmedStartClick = () => {
    startSession()
  }

  // Checking if data is loaded
  if (!data) return <div>Loading...</div>

  return (
    <>
      <Stack
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          width: '100%',
          gap: 2,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6">Jacuzzi</Typography>
          <Typography variant="h6">
            {t('devices.jacuzzi.target-temp', { temp: data.targetTemp })}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <JacuzziStartButton
            isRunning={isRunning}
            duration={duration()}
            viewData={data}
            onConfirmedStartClick={onConfirmedStartClick}
          />
          <Box>
            <Typography variant="body2">
              {data.state !== 'initializing' &&
                t('devices.jacuzzi.current-temp', { temp: data.currentTemp })}
              {data.state === 'initializing' &&
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
              <Typography variant="body2">{data.minTemp}&nbsp;°C</Typography>
              <Slider
                aria-label={t('devices.jacuzzi.slider.title')}
                min={data.minTemp}
                max={data.maxTemp}
                value={targetTemp}
                marks={[
                  {
                    value: data.defaultTemp,
                    label: `${data.defaultTemp}°C`,
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
              <Typography variant="body2">{data.maxTemp}&nbsp;°C</Typography>
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
