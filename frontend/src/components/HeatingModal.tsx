import type { HeatingViewData } from '@/models'
import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MobileDialog } from './MobileDialog'

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

  const [dayTemp, setDayTemp] = useState<number>(0)
  const [nightTemp, setNightTemp] = useState<number>(0)

  useEffect(() => {
    if (open) {
      setDayTemp(viewData.dayTemp)
      setNightTemp(viewData.nightTemp)
    }
  }, [open, viewData.dayTemp, viewData.nightTemp])

  const dayRange = `(${viewData.dayStart}:00 - ${viewData.nightStart}:00)`
  const nightRange = `(${viewData.nightStart}:00 - ${viewData.dayStart}:00)`

  return (
    <MobileDialog open={open} onClose={onClose}>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 1,
        }}
      >
        {t('devices.heating.title')}
        <IconButton onClick={onClose} edge="end" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 3, pt: 1 }}>
          <HeatingSlider
            label={t('devices.heating.dayPart', { range: dayRange })}
            value={dayTemp}
            onChange={setDayTemp}
            min={viewData.minTemp}
            max={viewData.maxTemp}
          />
          <HeatingSlider
            label={t('devices.heating.nightPart', { range: nightRange })}
            value={nightTemp}
            onChange={setNightTemp}
            min={viewData.minTemp}
            max={viewData.maxTemp}
          />
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{ p: 2, pt: 0, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}
      >
        <Button onClick={onClose} fullWidth sx={{ order: { xs: 2, sm: 1 } }}>
          {t('devices.heating.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(dayTemp, nightTemp)}
          fullWidth
          sx={{ order: { xs: 1, sm: 2 } }}
        >
          {t('devices.heating.save')}
        </Button>
      </DialogActions>
    </MobileDialog>
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
    <Stack sx={{ gap: 1.5 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Chip label={`${value}°C`} size="small" sx={{ fontWeight: 600 }} />
      </Stack>
      <Box sx={{ px: 0.5 }}>
        <Slider
          aria-label="Temperature Slider"
          value={value}
          min={min}
          max={max}
          sx={{ width: '100%' }}
          onChange={(_, value) => onChange(value as number)}
          step={0.5}
          marks={[
            { value: min, label: `${min}°C` },
            { value: max, label: `${max}°C` },
          ]}
          valueLabelDisplay="off"
          track={false}
        />
      </Box>
    </Stack>
  )
}
