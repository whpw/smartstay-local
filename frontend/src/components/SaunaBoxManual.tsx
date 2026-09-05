import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material'
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
      setViewData(data as SaunaViewData)
    },
  })

  const duration = useCallback(() => {
    return Math.max((viewData?.session?.endTime ?? 0) - Date.now(), 0)
  }, [viewData])

  const isRunning = isSessionRunning(viewData?.session?.endTime)

  const onConfirmedStartClick = () => {
    startSession()
  }

  return (
    <DeviceCard
      tone="sauna"
      active={isRunning}
      icon={<Box component="img" src={saunaIcon} alt="" />}
      title={viewData.name}
      status={
        isRunning ? (
          <Typography
            variant="caption"
            color="secondary"
            sx={{ fontWeight: 600 }}
          >
            {t('devices.sauna.ends-in', {
              time: formatRemaining(duration()),
            })}
          </Typography>
        ) : null
      }
      action={
        <SaunaStartButton
          isRunning={isRunning}
          viewData={viewData}
          onConfirmedStartClick={onConfirmedStartClick}
        />
      }
    >
      {isRunning && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
              {t('devices.sauna.instructions.title')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              component="ol"
              sx={{
                m: 0,
                pl: 2.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                color: 'text.secondary',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {t('devices.sauna.instructions.details', {
                defaultValue: '',
              })
                .split('\n')
                .map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
      <UpsellModal
        open={upsellingModalOpen}
        handleClose={() => setUpsellingModalOpen(false)}
      />
    </DeviceCard>
  )
}
