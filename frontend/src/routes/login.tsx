import { authClient } from '@/dao'
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

const isError = (data: unknown): data is { code: string } => {
  return (
    data !== null &&
    data !== undefined &&
    typeof data === 'object' &&
    'code' in data
  )
}

export const LoginRoute = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const {
    mutate: login,
    error,
    data: authData,
  } = useMutation({
    mutationFn: async ({
      resNumber,
      lastName,
    }: {
      resNumber: string
      lastName: string
    }) => {
      const res = await authClient.login.$post({
        json: {
          resNumber,
          lastName,
        },
      })

      return await res.json()
    },
    onSuccess: () => {
      navigate('/')
    },
    onError: (error) => {
      console.error('Error logging in', error)
    },
  })

  // Getting login error
  const loginError =
    (isError(error) && error) || (isError(authData) && authData)

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          {t('login.title')}
        </Typography>

        {loginError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {
              // @ts-expect-error
              t(loginError.code)
            }
          </Alert>
        )}

        <Box
          component="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const resNumber = formData.get('resNumber') as string
            const lastName = formData.get('lastName') as string
            login({ resNumber, lastName })
          }}
        >
          <Stack spacing={3}>
            <TextField
              name="lastName"
              placeholder={t('login.lastName')}
              variant="outlined"
              fullWidth
              required
            />

            <TextField
              name="resNumber"
              placeholder={t('login.resNumber')}
              variant="outlined"
              fullWidth
              required
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              sx={{ mt: 2 }}
            >
              {t('login.submit')}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Container>
  )
}
