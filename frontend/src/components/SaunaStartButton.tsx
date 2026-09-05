import type { SaunaViewData } from '@backend/models'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Box, Typography } from '@mui/material'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDialog } from './AppDialog'
import { formatClock } from '@/utils/formatRemaining'

const MINUTE = 60_000

export default function SaunaStartButton({
  isRunning,
  viewData,
  onConfirmedStartClick,
  showDetailsAccordion = true,
}: {
  isRunning: boolean
  viewData: SaunaViewData
  onConfirmedStartClick: () => void
  showDetailsAccordion?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [newSessionEnd, setNewSessionEnd] = useState<string | null>(null)

  const handleClose = () => setOpen(false)

  const onStartClick = () => {
    const end = new Date(Date.now() + viewData.sessionDuration * MINUTE)
    setNewSessionEnd(formatClock(end))
    setOpen(true)
  }

  const { t } = useTranslation()

  if (isRunning) return null

  return (
    <>
      <Button
        type="button"
        onClick={onStartClick}
        disabled={viewData.state === 'initializing' || viewData.pollingError}
        variant="contained"
      >
        {t('devices.sauna.start')}
      </Button>
      <AppDialog
        open={open}
        onClose={handleClose}
        title={t('devices.sauna.modal.title')}
        actions={
          <>
            <Button onClick={handleClose}>
              {t('devices.sauna.modal.cancel')}
            </Button>
            <Button
              onClick={() => {
                onConfirmedStartClick()
                handleClose()
              }}
              variant="contained"
            >
              {t('devices.sauna.modal.start')}
            </Button>
          </>
        }
      >
        <Typography
          color="text.secondary"
          sx={{ mb: showDetailsAccordion ? 2 : 0 }}
        >
          {t('devices.sauna.modal.until', {
            time: newSessionEnd,
          })}
        </Typography>
        {showDetailsAccordion ? (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{t('devices.sauna.modal.more-info')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography color="text.secondary">
                {t('devices.sauna.modal.details')}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ) : (
          <Box sx={{ minHeight: 8 }} />
        )}
      </AppDialog>
    </>
  )
}
