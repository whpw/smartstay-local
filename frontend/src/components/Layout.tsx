import { infoClient } from '@/dao'
import {
  Box,
  Container,
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
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        mt: 8,
      }}
    >
      <Stack sx={{ alignItems: 'center', gap: 2, mb: 3 }}>
        <Box component="img" src={logo} alt="logo" sx={{ width: 300 }} />
        <Typography variant="h6" fontSize={24} color="textSecondary">
          {data?.objectName}
        </Typography>
      </Stack>

      <Box
        sx={{
          flex: 1,
          flexBasis: '100%',
          width: '100%',
        }}
      >
        <Outlet />
      </Box>
    </Container>
  )
}
