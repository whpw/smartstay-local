import { Box, Slider } from '@mui/material'

export const TempSlider = ({
  min,
  max,
  value,
  onChange,
  onChangeCommitted,
  disabled,
  defaultTemp,
  ariaLabel,
  step,
}: {
  min: number
  max: number
  value: number | undefined
  onChange: (value: number) => void
  onChangeCommitted?: (value: number) => void
  disabled?: boolean
  defaultTemp?: number
  ariaLabel: string
  step?: number
}) => {
  const marks = [
    { value: min, label: `${min}°` },
    ...(defaultTemp != null && defaultTemp !== min && defaultTemp !== max
      ? [{ value: defaultTemp, label: `${defaultTemp}°` }]
      : []),
    { value: max, label: `${max}°` },
  ]

  return (
    <Box sx={{ px: 0.5, pt: 0.5, pb: 1 }}>
      <Slider
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        marks={marks}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v}°`}
        onChange={(_e, next) => onChange(next as number)}
        onChangeCommitted={
          onChangeCommitted
            ? (_e, next) => onChangeCommitted(next as number)
            : undefined
        }
      />
    </Box>
  )
}
