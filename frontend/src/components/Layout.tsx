import { Box, Typography, useColorScheme } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { infoClient } from '@/dao'

const logoForLightTheme = '/logo-dark.png'
const logoForDarkTheme = '/logo-light.png'

export const Layout = () => {
  const { mode } = useColorScheme()
  const logo = mode === 'light' ? logoForLightTheme : logoForDarkTheme

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
          <Box
            component="img"
            src={logo}
            alt="SmartStay"
            sx={{ height: 28, width: 'auto', maxWidth: 168 }}
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
