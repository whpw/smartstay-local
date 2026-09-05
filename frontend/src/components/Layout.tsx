import { infoClient } from '@/dao'
import {
  Box,
  Container,
  Skeleton,
  Stack,
  Typography,
  useColorScheme,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'

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

  return (
    <Container
      component="main"
      maxWidth="sm"
      disableGutters
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100dvh',
        px: { xs: 2, sm: 3 },
        pt: 'calc(var(--safe-top) + 24px)',
        pb: 'calc(var(--safe-bottom) + 24px)',
      }}
    >
      <Stack
        sx={{
          alignItems: 'center',
          gap: 1,
          mb: { xs: 3, sm: 4 },
          width: '100%',
        }}
      >
        <Box
          component="img"
          src={logo}
          alt="SmartStay"
          sx={{
            width: { xs: 180, sm: 220 },
            height: 'auto',
          }}
        />
        {data?.objectName ? (
          <Typography
            variant="subtitle1"
            color="text.secondary"
            align="center"
            sx={{ fontSize: { xs: '0.9375rem', sm: '1rem' } }}
          >
            {data.objectName}
          </Typography>
        ) : (
          <Skeleton variant="text" width={160} height={24} />
        )}
      </Stack>

      <Box sx={{ flex: 1, width: '100%' }}>
        <Outlet />
      </Box>
    </Container>
  )
}
