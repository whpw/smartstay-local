import { authClient } from '@/dao'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
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
    <Box
      sx={{
        mt: 1,
        p: 2.5,
        borderRadius: '22px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 8px 24px rgba(28, 25, 23, 0.04)',
      }}
    >
      <Typography
        variant="h5"
        component="h1"
        sx={{ mb: 0.75, textAlign: 'center' }}
      >
        {t('login.title')}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mb: 3, textAlign: 'center', fontSize: 14 }}
      >
        {t('login.subtitle')}
      </Typography>

      {loginError && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
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
        <Stack spacing={2}>
          <TextField
            name="lastName"
            label={t('login.lastName')}
            autoComplete="family-name"
            autoCapitalize="words"
            autoCorrect="off"
            enterKeyHint="next"
            variant="outlined"
            required
            disabled={isPending}
          />

          <TextField
            name="resNumber"
            label={t('login.resNumber')}
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="go"
            variant="outlined"
            required
            disabled={isPending}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isPending}
          >
            {t('login.submit')}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
