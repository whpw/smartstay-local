import { TZDate } from '@date-fns/tz'
import {
  Box,
  Checkbox,
  FormControlLabel,
  Paper,
  Typography,
} from '@mui/material'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { lightFormat } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { JacuzziViewData } from '@repo/backend/models'

const MINUTE = 60_000

export default function JacuzziStartButton({
  isRunning,
  duration,
  viewData,
  onConfirmedStartClick,
}: {
  isRunning: boolean
  duration: number
  viewData: JacuzziViewData
  onConfirmedStartClick: () => void
}) {
  // Translation
  const { t } = useTranslation()

  // Dialog state
  const [open, setOpen] = useState(false)

  // Time when new session will end
  const [newSessionEnd, setNewSessionEnd] = useState<string | null>(null)

  // Jacuzzi safety checkboxes state
  const [rulesChecks, setRulesChecks] = useState({
    shower: false,
    noLiquids: false,
    noAnimals: false,
  })

  const handleClose = () => setOpen(false)

  const onStartClick = () => {
    const end = new Date(Date.now() + viewData.sessionDuration * MINUTE)
    setNewSessionEnd(lightFormat(end, 'HH:mm'))
    setOpen(true)
  }

  return (
    <Box>
      <Button
        type="button"
        onClick={onStartClick}
        disabled={isRunning}
        variant="contained"
      >
        {isRunning
          ? t('devices.jacuzzi.ends-in', {
              time: lightFormat(new TZDate(duration, 'UTC'), 'HH:mm'),
            })
          : t('devices.jacuzzi.start')}
      </Button>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{t('devices.jacuzzi.modal.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('devices.jacuzzi.modal.until', {
              time: newSessionEnd,
            })}
          </DialogContentText>
          <Paper
            sx={{
              p: 2,
              mt: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="body1">
              {t('devices.jacuzzi.modal.safety-rules')}
            </Typography>
            <FormControlLabel
              control={<Checkbox />}
              label={t('devices.jacuzzi.modal.shower-rule')}
              checked={rulesChecks.shower}
              onChange={(e) => {
                setRulesChecks({
                  ...rulesChecks,
                  shower: (e.currentTarget as HTMLInputElement).checked,
                })
              }}
            />
            <FormControlLabel
              control={<Checkbox />}
              label={t('devices.jacuzzi.modal.no-liquids-rule')}
              checked={rulesChecks.noLiquids}
              onChange={(e) => {
                setRulesChecks({
                  ...rulesChecks,
                  noLiquids: (e.currentTarget as HTMLInputElement).checked,
                })
              }}
            />
            <FormControlLabel
              control={<Checkbox />}
              label={t('devices.jacuzzi.modal.no-animals-rule')}
              checked={rulesChecks.noAnimals}
              onChange={(e) => {
                setRulesChecks({
                  ...rulesChecks,
                  noAnimals: (e.currentTarget as HTMLInputElement).checked,
                })
              }}
            />
          </Paper>
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
            disabled={
              !rulesChecks.shower ||
              !rulesChecks.noLiquids ||
              !rulesChecks.noAnimals
            }
          >
            {t('devices.sauna.modal.start')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
