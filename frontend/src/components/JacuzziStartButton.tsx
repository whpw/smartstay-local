import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material'
import Button from '@mui/material/Button'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { JacuzziViewData } from '@backend/models'
import { formatClock } from '@/utils/formatRemaining'
import { AppDialog } from './AppDialog'

const MINUTE = 60_000

export default function JacuzziStartButton({
  viewData,
  isRunning,
  onConfirmedStartClick,
}: {
  viewData: JacuzziViewData
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
    setNewSessionEnd(formatClock(end))
    setRulesChecks({ shower: false, noLiquids: false, noAnimals: false })
    setOpen(true)
  }

  if (isRunning) return null

  return (
    <Box>
      <Button
        type="button"
        onClick={onStartClick}
        disabled={viewData.state === 'eco' || viewData.pollingError}
        variant="contained"
      >
        {t('devices.jacuzzi.start')}
      </Button>
      <AppDialog
        open={open}
        onClose={handleClose}
        title={t('devices.jacuzzi.modal.title')}
        actions={
          <>
            <Button onClick={handleClose}>
              {t('devices.jacuzzi.modal.cancel')}
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
              {t('devices.jacuzzi.modal.start')}
            </Button>
          </>
        }
      >
        <Typography color="text.secondary">
          {t('devices.jacuzzi.modal.until', {
            time: newSessionEnd,
          })}
        </Typography>
        <Stack
          sx={{
            p: 2,
            mt: 2,
            borderRadius: '16px',
            bgcolor: 'rgba(28, 25, 23, 0.04)',
            gap: 0.5,
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1 }}>
            {t('devices.jacuzzi.modal.safety-rules')}
          </Typography>
          <RuleCheck
            label={t('devices.jacuzzi.modal.shower-rule')}
            checked={rulesChecks.shower}
            onChange={(checked) =>
              setRulesChecks({ ...rulesChecks, shower: checked })
            }
          />
          <RuleCheck
            label={t('devices.jacuzzi.modal.no-liquids-rule')}
            checked={rulesChecks.noLiquids}
            onChange={(checked) =>
              setRulesChecks({ ...rulesChecks, noLiquids: checked })
            }
          />
          <RuleCheck
            label={t('devices.jacuzzi.modal.no-animals-rule')}
            checked={rulesChecks.noAnimals}
            onChange={(checked) =>
              setRulesChecks({ ...rulesChecks, noAnimals: checked })
            }
          />
        </Stack>
      </AppDialog>
    </Box>
  )
}

const RuleCheck = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <FormControlLabel
    sx={{
      alignItems: 'flex-start',
      mx: 0,
      py: 1,
      '& .MuiFormControlLabel-label': {
        fontSize: 14,
        lineHeight: 1.4,
        pt: 1,
      },
    }}
    control={
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        sx={{ mt: -0.25 }}
      />
    }
    label={label}
  />
)
