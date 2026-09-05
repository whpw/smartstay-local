import { deviceColors } from '@/theme'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from '@mui/material'
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
import { DeviceCardSkeleton } from './DeviceCardSkeleton'

export const SaunaBoxManual = ({
  viewData,
  setViewData,
  deviceId,
}: {
  viewData: SaunaViewData
  setViewData: (data: SaunaViewData) => void
  deviceId: string
}) => {
  const { t } = useTranslation()

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

  if (!viewData) return <DeviceCardSkeleton />

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
        <SaunaStartButton
          isRunning={isRunning}
          duration={duration()}
          viewData={viewData}
          onConfirmedStartClick={onConfirmedStartClick}
        />
      }
    >
      {isRunning && (
        <Box sx={{ mt: 2 }}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>
                {t('devices.sauna.instructions.title')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="ol"
                sx={{
                  m: 0,
                  pl: 2.5,
                  '& li': { mb: 1.5 },
                  '& li:last-child': { mb: 0 },
                }}
              >
                {t('devices.sauna.instructions.details', {
                  defaultValue: '',
                })
                  .split('\n')
                  .map((line, index) => (
                    <Box component="li" key={index}>
                      {line}
                    </Box>
                  ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
      <UpsellModal
        open={upsellingModalOpen}
        handleClose={() => setUpsellingModalOpen(false)}
      />
    </BoxContainer>
  )
}
