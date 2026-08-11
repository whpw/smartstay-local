import { Box, Stack, Typography } from '@mui/material'
import type { PropsWithChildren } from 'react'

export const BoxContainer = ({
  children,
  title,
  ctaButton,
  currentTemp,
  targetTemp,
}: PropsWithChildren<{
  title: string | React.ReactNode
  ctaButton: React.ReactNode
  targetTemp?: string
  currentTemp?: string
}>) => {
  return (
    <Stack
      sx={{
        position: 'relative',
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        width: '100%',
        gap: 2,
        overflow: 'hidden',
      }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Stack sx={{ flexBasis: '60%' }}>
          <Box sx={{ fontSize: 24, mb: 1 }}>{title}</Box>
          <Box>{ctaButton}</Box>
        </Stack>
        <Stack sx={{ alignItems: 'end' }}>
          {targetTemp && <Box sx={{ fontSize: 28 }}>{targetTemp}</Box>}
          {currentTemp && (
            <Typography variant="caption">{currentTemp}</Typography>
          )}
        </Stack>
      </Stack>
      {children}
    </Stack>
  )
}
