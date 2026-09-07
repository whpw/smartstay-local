import { authClient } from '@/dao'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
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
    data: authData,
    error: authError,
    isPending,
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

      if (res.status !== 200) {
        console.error('Error logging in:', res.statusText)
        throw await res.json().catch(() => {
          return { code: 'login.error' }
        })
      }
    },
    onSuccess: () => {
      navigate('/')
    },
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const lastName = params.get('lastName')
    const resNumber = params.get('resNumber')
    if (lastName && resNumber) {
      login({ lastName, resNumber })
    }
  }, [login])

  const loginError =
    (isError(authError) && authError) || (isError(authData) && authData)

  return (
    <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
        }}
      >
        <Stack spacing={1} sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h5" component="h1">
            {t('login.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('login.subtitle', { defaultValue: 'Wprowadź dane rezerwacji' })}
          </Typography>
        </Stack>

        {loginError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
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
          <Stack spacing={2.5}>
            <TextField
              name="lastName"
              label={t('login.lastName')}
              autoComplete="family-name"
              autoCapitalize="words"
              fullWidth
              required
              disabled={isPending}
            />

            <TextField
              name="resNumber"
              label={t('login.resNumber')}
              inputMode="numeric"
              autoComplete="off"
              fullWidth
              required
              disabled={isPending}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={isPending}
              sx={{ mt: 1 }}
            >
              {t('login.submit')}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
