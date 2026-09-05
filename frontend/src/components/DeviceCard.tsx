import { Box, Skeleton, Stack, Typography } from '@mui/material'
import type { PropsWithChildren, ReactNode } from 'react'

export type DeviceTone = 'sauna' | 'jacuzzi' | 'heating' | 'light'

const TONE_WELL: Record<DeviceTone, string> = {
  sauna: 'rgba(180, 83, 9, 0.12)',
  jacuzzi: 'rgba(56, 112, 148, 0.12)',
  heating: 'rgba(180, 72, 48, 0.12)',
  light: 'rgba(196, 148, 40, 0.16)',
}

export const DeviceCard = ({
  children,
  title,
  icon,
  tone = 'heating',
  action,
  status,
  targetTemp,
  currentTemp,
  active = false,
}: PropsWithChildren<{
  title: ReactNode
  icon: ReactNode
  tone?: DeviceTone
  action?: ReactNode
  status?: ReactNode
  targetTemp?: ReactNode
  currentTemp?: ReactNode
  active?: boolean
}>) => {
  const hasTemp = targetTemp != null || currentTemp != null

  return (
    <Stack
      sx={{
        position: 'relative',
        p: 2.25,
        borderRadius: '22px',
        border: '1px solid',
        borderColor: active ? 'secondary.main' : 'divider',
        bgcolor: 'background.paper',
        width: '100%',
        gap: 2,
        overflow: 'hidden',
        boxShadow: active
          ? '0 10px 28px rgba(28, 25, 23, 0.07)'
          : '0 8px 24px rgba(28, 25, 23, 0.04)',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: TONE_WELL[tone],
            flexShrink: 0,
            '& img': { width: 22, height: 22, objectFit: 'contain' },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.25,
            }}
          >
            {title}
          </Typography>
          {status}
        </Box>
        {!hasTemp && action != null && (
          <Box sx={{ flexShrink: 0 }}>{action}</Box>
        )}
      </Stack>

      {hasTemp && (
        <Stack
          direction="row"
          sx={{
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {targetTemp != null && (
              <Typography
                sx={{
                  fontSize: '2.75rem',
                  fontWeight: 600,
                  letterSpacing: '-0.05em',
                  lineHeight: 0.95,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {typeof targetTemp === 'number' ? `${targetTemp}°` : targetTemp}
              </Typography>
            )}
            {currentTemp != null && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75, fontSize: 13, fontWeight: 500 }}
              >
                {currentTemp}
              </Typography>
            )}
          </Box>
          {action != null && (
            <Box
              sx={{
                flexShrink: 0,
                '& .MuiButton-root': { minWidth: 108 },
              }}
            >
              {action}
            </Box>
          )}
        </Stack>
      )}

      {children}
    </Stack>
  )
}

export const DeviceCardSkeleton = () => (
  <Stack
    sx={{
      p: 2.25,
      borderRadius: '22px',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      width: '100%',
      gap: 2,
    }}
  >
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
      <Skeleton
        variant="rounded"
        width={44}
        height={44}
        sx={{ borderRadius: '14px' }}
      />
      <Skeleton width="42%" height={22} />
    </Stack>
    <Stack
      direction="row"
      sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}
    >
      <Skeleton width={96} height={48} />
      <Skeleton
        variant="rounded"
        width={108}
        height={48}
        sx={{ borderRadius: '14px' }}
      />
    </Stack>
  </Stack>
)
