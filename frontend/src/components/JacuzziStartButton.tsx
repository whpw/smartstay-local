import { TZDate } from '@date-fns/tz'
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Typography,
} from '@mui/material'
import { lightFormat } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { JacuzziViewData } from '@backend/models'
import { MobileDialog } from './MobileDialog'

const MINUTE = 60_000

export default function JacuzziStartButton({
  viewData,
  duration,
  isRunning,
  onConfirmedStartClick,
}: {
  viewData: JacuzziViewData
  duration: number
  isRunning: boolean
  onConfirmedStartClick: () => void
}) {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)
  const [newSessionEnd, setNewSessionEnd] = useState<string | null>(null)
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

  const allRulesAccepted =
    rulesChecks.shower && rulesChecks.noLiquids && rulesChecks.noAnimals

  return (
    <>
      <Button
        type="button"
        onClick={onStartClick}
        disabled={
          isRunning || viewData.state === 'eco' || viewData.pollingError
        }
        variant="contained"
      >
        {isRunning
          ? t('devices.jacuzzi.ends-in', {
              time: lightFormat(new TZDate(duration, 'UTC'), 'HH:mm'),
            })
          : t('devices.jacuzzi.start')}
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
          {t('devices.jacuzzi.modal.title')}
          <IconButton onClick={handleClose} edge="end" aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '1rem', mb: 2 }}>
            {t('devices.jacuzzi.modal.until', {
              time: newSessionEnd,
            })}
          </DialogContentText>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
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
              sx={{ alignItems: 'flex-start', mx: 0 }}
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
              sx={{ alignItems: 'flex-start', mx: 0 }}
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
              sx={{ alignItems: 'flex-start', mx: 0 }}
            />
          </Paper>
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
            disabled={!allRulesAccepted}
            sx={{ order: { xs: 1, sm: 2 } }}
          >
            {t('devices.sauna.modal.start')}
          </Button>
        </DialogActions>
      </MobileDialog>
    </>
  )
}
