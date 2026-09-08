import type { HeatingViewData } from '@/models'
import { Chip } from '@mui/material'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDialog } from './AppDialog'
import { TempSlider } from './TempSlider'

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

  const dayRange = `${viewData.dayStart}:00 – ${viewData.nightStart}:00`
  const nightRange = `${viewData.nightStart}:00 – ${viewData.dayStart}:00`

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={t('devices.heating.title')}
      actions={
        <>
          <Button onClick={onClose}>{t('devices.heating.cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => onConfirm(dayTemp, nightTemp)}
          >
            {t('devices.heating.save')}
          </Button>
        </>
      }
    >
      <Stack sx={{ mt: 1, gap: 3 }}>
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
    </AppDialog>
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
    <Stack sx={{ gap: 0.5 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Typography>
        <Chip label={`${value}°`} size="small" />
      </Stack>
      <TempSlider
        ariaLabel={label}
        value={value}
        min={min}
        max={max}
        step={0.5}
        onChange={onChange}
      />
    </Stack>
  )
}
