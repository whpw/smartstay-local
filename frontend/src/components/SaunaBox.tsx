import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import SaunaStartButton from './SaunaStartButton'
import { UpsellModal } from './UpsellModal'

import saunaIcon from '@/assets/sauna.png'
import { authedClient } from '@/dao'
import { isSessionRunning } from '@/utils/isSessionRunning'
import type { SaunaViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { BoxContainer } from './BoxContainer'

export const SaunaBox = ({ deviceId }: { deviceId: string }) => {
  // Data state
  const [viewData, setViewData] = useState<SaunaViewData>()

  const { t } = useTranslation()

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
      setViewData(data as SaunaViewData)
    },
  })

  useEffect(() => {
    const evtSource = new EventSource(`/api/state/${deviceId}`, {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const receivedData = JSON.parse(event.data)
      console.log('Received sauna state update:', receivedData)
      setViewData(receivedData as SaunaViewData)
    })

    return () => {
      evtSource.close()
    }
  }, [deviceId])

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
        <Stack direction="row" alignItems="center" gap={1}>
          <Box component="img" src={saunaIcon} sx={{ width: 24 }} />
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
              <Typography className="font-semibold">
                {t('devices.sauna.instructions.title')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <ol className="list-decimal">
                {t('devices.sauna.instructions.details', {
                  defaultValue: '',
                })
                  .split('\n')
                  .map((line, index) => (
                    <li key={index} className="first:mt-0 mt-4">
                      {line}
                    </li>
                  ))}
              </ol>
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
