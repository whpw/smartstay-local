import { TZDate } from '@date-fns/tz'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import type { SaunaViewData } from '@repo/backend/models'
import { lightFormat } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const MINUTE = 60_000

export default function SaunaStartButton({
  isRunning,
  duration,
  viewData,
  onConfirmedStartClick,
}: {
  isRunning: boolean
  duration: number
  viewData: SaunaViewData
  onConfirmedStartClick: () => void
}) {
  const [open, setOpen] = useState(false)
  // Time when new session will end
  const [newSessionEnd, setNewSessionEnd] = useState<string | null>(null)

  const handleClose = () => setOpen(false)

  const onStartClick = () => {
    const end = new Date(Date.now() + viewData.sessionDuration * MINUTE)
    setNewSessionEnd(lightFormat(end, 'HH:mm'))
    setOpen(true)
  }

  const { t } = useTranslation()

  return (
    <div>
      <Button
        type="button"
        onClick={onStartClick}
        disabled={isRunning}
        variant="contained"
      >
        {isRunning
          ? t('devices.sauna.ends-in', {
              time: lightFormat(new TZDate(duration, 'UTC'), 'HH:mm'),
            })
          : t('devices.sauna.start')}
      </Button>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{t('devices.sauna.modal.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('devices.sauna.modal.until', {
              time: newSessionEnd,
            })}
          </DialogContentText>
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{t('devices.sauna.modal.more-info')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>{t('devices.sauna.modal.details')}</Typography>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </div>
  )
}
