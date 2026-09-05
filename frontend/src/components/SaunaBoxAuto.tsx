import { deviceColors } from '@/theme'
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

  if (!viewData) return null

  return (
    <BoxContainer
      accent={deviceColors.sauna}
      title={
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            component="img"
            src={saunaIcon}
            alt=""
            sx={{ width: 28, height: 28, objectFit: 'contain' }}
          />
          <>{viewData.name}</>
        </Stack>
      }
      ctaButton={
        <>
          {isRunning && (
            <Button
              type="button"
              variant="outlined"
              color="inherit"
              onClick={() => onStop()}
            >
              {t('devices.sauna.stop')}
            </Button>
          )}
          <SaunaStartButton
            isRunning={isRunning}
            duration={duration()}
            viewData={viewData}
            onConfirmedStartClick={onConfirmedStartClick}
            showDetailsAccordion={false}
          />
        </>
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
        <Box sx={{ px: { xs: 0, sm: 1 } }}>
          <Slider
            sx={{ width: '100%' }}
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
