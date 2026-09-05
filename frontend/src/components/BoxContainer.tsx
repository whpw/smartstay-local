import { Box, Paper, Stack, Typography } from '@mui/material'
import type { PropsWithChildren, ReactNode } from 'react'

export const BoxContainer = ({
  children,
  title,
  ctaButton,
  currentTemp,
  targetTemp,
  accent = '#1A1A1A',
}: PropsWithChildren<{
  title: ReactNode
  ctaButton: ReactNode
  targetTemp?: ReactNode
  currentTemp?: ReactNode
  accent?: string
}>) => {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 480,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      <Box
        sx={{
          height: 4,
          bgcolor: accent,
        }}
      />
      <Stack sx={{ p: { xs: 2, sm: 2.5 }, gap: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            gap: { xs: 2, sm: 1 },
          }}
        >
          <Stack sx={{ flex: 1, gap: 1.5 }}>
            <Typography
              component="div"
              variant="h6"
              sx={{ fontSize: { xs: '1.0625rem', sm: '1.125rem' } }}
            >
              {title}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                '& .MuiButton-root': {
                  flex: { xs: '1 1 auto', sm: '0 0 auto' },
                  minWidth: { xs: 'calc(50% - 4px)', sm: 'auto' },
                },
              }}
            >
              {ctaButton}
            </Box>
          </Stack>

          {(targetTemp || currentTemp) && (
            <Stack
              sx={{
                alignItems: { xs: 'flex-start', sm: 'flex-end' },
                flexShrink: 0,
                gap: 0.5,
              }}
            >
              {targetTemp && (
                <Typography
                  component="div"
                  sx={{
                    fontSize: { xs: '1.5rem', sm: '1.75rem' },
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    color: 'text.primary',
                  }}
                >
                  {targetTemp}
                </Typography>
              )}
              {currentTemp && (
                <Typography
                  component="div"
                  variant="body2"
                  color="text.secondary"
                >
                  {currentTemp}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>

        {children}
      </Stack>
    </Paper>
  )
}
