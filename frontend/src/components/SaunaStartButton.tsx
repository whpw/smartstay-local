import type { SaunaViewData } from '@backend/models'
import { TZDate } from '@date-fns/tz'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from '@mui/material'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Typography from '@mui/material/Typography'
import { lightFormat } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MobileDialog } from './MobileDialog'

const MINUTE = 60_000

export default function SaunaStartButton({
  isRunning,
  duration,
  viewData,
  onConfirmedStartClick,
  showDetailsAccordion = true,
}: {
  isRunning: boolean
  duration: number
  viewData: SaunaViewData
  onConfirmedStartClick: () => void
  showDetailsAccordion?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [newSessionEnd, setNewSessionEnd] = useState<string | null>(null)

  const handleClose = () => setOpen(false)

  const onStartClick = () => {
    const end = new Date(Date.now() + viewData.sessionDuration * MINUTE)
    setNewSessionEnd(lightFormat(end, 'HH:mm'))
    setOpen(true)
  }

  const { t } = useTranslation()

  return (
    <>
      <Button
        type="button"
        onClick={onStartClick}
        disabled={
          isRunning ||
          viewData.state === 'initializing' ||
          viewData.pollingError
        }
        variant="contained"
      >
        {isRunning
          ? t('devices.sauna.ends-in', {
              time: lightFormat(new TZDate(duration, 'UTC'), 'HH:mm'),
            })
          : t('devices.sauna.start')}
      </Button>
      <MobileDialog open={open} onClose={handleClose}>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pr: 1,
          }}
        >
          {t('devices.sauna.modal.title')}
          <IconButton onClick={handleClose} edge="end" aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '1rem' }}>
            {t('devices.sauna.modal.until', {
              time: newSessionEnd,
            })}
          </DialogContentText>
          {showDetailsAccordion ? (
            <Accordion
              sx={{
                mt: 2,
                boxShadow: 'none',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 500 }}>
                  {t('devices.sauna.modal.more-info')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2">
                  {t('devices.sauna.modal.details')}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Box sx={{ minHeight: 8 }} />
          )}
        </DialogContent>
        <DialogActions
          sx={{
            p: 2,
            pt: 0,
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1,
          }}
        >
          <Button
            onClick={handleClose}
            fullWidth
            sx={{ order: { xs: 2, sm: 1 } }}
          >
            {t('devices.sauna.modal.cancel')}
          </Button>
          <Button
            onClick={() => {
              onConfirmedStartClick()
              handleClose()
            }}
            variant="contained"
            fullWidth
            sx={{ order: { xs: 1, sm: 2 } }}
          >
            {t('devices.sauna.modal.start')}
          </Button>
        </DialogActions>
      </MobileDialog>
    </>
  )
}
