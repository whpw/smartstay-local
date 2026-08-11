import { Box, Button, Slider, Stack } from '@mui/material'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import SaunaStartButton from './SaunaStartButton'
import { UpsellModal } from './UpsellModal'

import saunaIcon from '@/assets/sauna.png'
import { authedClient } from '@/dao'
import { isSessionRunning } from '@/utils/isSessionRunning'
import type { SaunaViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { BoxContainer } from './BoxContainer'
import { PollingErrorCover } from './PollingErrorCover'

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

  // Target temp
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
      // Setting da
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

  // Calculating duration that is left
  const duration = useCallback(() => {
    return Math.max((viewData?.session?.endTime ?? 0) - Date.now(), 0)
  }, [viewData])

  // Checking if session is running
  const isRunning = isSessionRunning(viewData?.session?.endTime)

  const onConfirmedStartClick = () => {
    startSession()
  }

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
          <Box component="img" src={saunaIcon} sx={{ width: 24 }} />
          <>{viewData.name}</>
        </Stack>
      }
      ctaButton={
        <Box
          sx={{
            display: 'flex',
            gap: 2,
          }}>
          {isRunning && (
            <Box>
              <Button
                type="button"
                variant="contained"
                onClick={() => onStop()}
              >
                {t('devices.sauna.stop')}
              </Button>
            </Box>
          )}
          <SaunaStartButton
            isRunning={isRunning}
            duration={duration()}
            viewData={viewData}
            onConfirmedStartClick={onConfirmedStartClick}
            showDetailsAccordion={false}
          />
        </Box>
      }
      currentTemp={
        viewData.state === 'initializing'
          ? t('devices.sauna.initializing')
          : t('devices.sauna.current-temp', {
              temp: viewData.currentTemp,
            })
      }
      targetTemp={t('devices.sauna.target-temp', {
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
              aria-label={t('devices.sauna.slider.title')}
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
