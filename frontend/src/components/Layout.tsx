import { Box, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { infoClient } from '@/dao'

/** Dark wordmark — for light backgrounds */
const logoForLightTheme = '/logo-dark.png'
/** Light wordmark — for dark backgrounds */
const logoForDarkTheme = '/logo-light.png'

const logoSx = {
  height: 28,
  width: 'auto',
  maxWidth: 168,
  display: 'block',
} as const

export const Layout = () => {
  const { data } = useQuery({
    queryKey: ['info'],
    queryFn: () => {
      return infoClient.info.$get().then((res) => res.json())
    },
  })

  const place = [data?.objectName, data?.roomName].filter(Boolean).join(' · ')

  return (
    <Box
      component="main"
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        px: 2,
        pt: 'max(12px, env(safe-area-inset-top))',
        pb: 'max(24px, env(safe-area-inset-bottom))',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 480,
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            py: 2,
            mb: 1,
          }}
        >
          {/* Swap via the same prefers-color-scheme media query as the theme
              palette (colorSchemeSelector: 'media'), not useColorScheme().mode
              which stays at defaultMode="light". */}
          <Box
            component="img"
            src={logoForLightTheme}
            alt="SmartStay"
            sx={(theme) => ({
              ...logoSx,
              ...theme.applyStyles('dark', { display: 'none' }),
            })}
          />
          <Box
            component="img"
            src={logoForDarkTheme}
            alt=""
            aria-hidden
            sx={(theme) => ({
              ...logoSx,
              display: 'none',
              ...theme.applyStyles('dark', { display: 'block' }),
            })}
          />
          {place && (
            <Typography
              component="p"
              color="text.secondary"
              sx={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {place}
            </Typography>
          )}
        </Box>

        <Box sx={{ flex: 1, width: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
