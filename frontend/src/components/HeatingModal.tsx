import type { HeatingViewData } from '@/models'
import { Box, Chip } from '@mui/material'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const HeatingModal = ({
  open,
  onClose,
  viewData,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  viewData: HeatingViewData
  onConfirm: (dayTemp: number, nightTemp: number) => void
}) => {
  const { t } = useTranslation()

  // State
  const [dayTemp, setDayTemp] = useState<number>(0)
  const [nightTemp, setNightTemp] = useState<number>(0)

  // Update state when modal opens
  useEffect(() => {
    if (open) {
      setDayTemp(viewData.dayTemp)
      setNightTemp(viewData.nightTemp)
    }
  }, [open])

  // Calculate ranges
  const dayRange = `(${viewData.dayStart}:00 - ${viewData.nightStart}:00)`
  const nightRange = `(${viewData.nightStart}:00 - ${viewData.dayStart}:00)`

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{t('devices.heating.title')}</DialogTitle>
      <DialogContent>
        <Stack
          sx={{
            mt: 2,
            gap: 2,
          }}>
          <HeatingSlider
            label={t('devices.heating.dayPart', {
              range: dayRange,
            })}
            value={dayTemp}
            onChange={setDayTemp}
            min={viewData.minTemp}
            max={viewData.maxTemp}
          />
          <HeatingSlider
            label={t('devices.heating.nightPart', {
              range: nightRange,
            })}
            value={nightTemp}
            onChange={setNightTemp}
            min={viewData.minTemp}
            max={viewData.maxTemp}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('devices.heating.cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(dayTemp, nightTemp)}
        >
          {t('devices.heating.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const HeatingSlider = ({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}) => {
  return (
    <Stack sx={{ gap: 1 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <Typography sx={{ fontSize: 14, fontWeight: 'medium' }}>
          {label}
        </Typography>
        <Chip label={`${value}°C`} sx={{ fontSize: 14 }} />
      </Stack>
      <Box
        sx={{
          mx: 1,
        }}>
        <Slider
          aria-label="Temperature Slider"
          value={value}
          min={min}
          max={max}
          sx={{ width: '100%', mb: 1.5 }}
          onChange={(_, value) => onChange(value as number)}
          step={0.5}
          marks={[
            {
              value: min,
              label: `${min}°C`,
            },
            {
              value: max,
              label: `${max}°C`,
            },
          ]}
          valueLabelDisplay="off"
          track={false}
        />
      </Box>
    </Stack>
  )
}
