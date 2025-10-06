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

import { isSessionRunning } from '@/utils/isSessionRunning'
import { authedClient } from '@repo/backend/client'
import type { SaunaViewData } from '@repo/backend/controllers'
import { useMutation } from '@tanstack/react-query'

export const SaunaBox = ({ deviceId }: { deviceId: string }) => {
  // Data state
  const [data, setData] = useState<SaunaViewData>()

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
      setData(data)
    },
  })

  useEffect(() => {
    const evtSource = new EventSource(`/api/state/${deviceId}`, {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const receivedData = JSON.parse(event.data)
      console.log('Received sauna state update:', receivedData)
      setData(receivedData)
    })

    return () => {
      evtSource.close()
    }
  }, [deviceId])

  // Calculating duration that is left
  const duration = useCallback(() => {
    return Math.max((data?.session?.endTime ?? 0) - Date.now(), 0)
  }, [data])

  // Checking if session is running
  const isRunning = isSessionRunning(data?.session?.endTime)

  const onConfirmedStartClick = () => {
    startSession()
  }

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
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6">Sauna</Typography>
        </Stack>
        <Stack
          sx={{
            mt: 2,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <SaunaStartButton
            isRunning={isRunning}
            duration={duration()}
            viewData={data}
            onConfirmedStartClick={onConfirmedStartClick}
          />
        </Stack>
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
      </Stack>
      <UpsellModal
        open={upsellingModalOpen}
        handleClose={() => setUpsellingModalOpen(false)}
      />
    </>
  )
}
