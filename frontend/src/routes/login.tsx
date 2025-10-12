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
import { authClient } from '@repo/backend/client'
import { useMutation } from '@tanstack/react-query'
import useSignIn from 'react-auth-kit/hooks/useSignIn'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

const getCookies = function () {
  return document.cookie.split(';').reduce(
    (ac, cv) =>
      Object.assign(ac, {
        [cv.split('=')[0].trim()]: cv.split('=')[1].trim(),
      }),
    {}
  ) as Record<string, string>
}

function parseJwt(token: string) {
  const base64Url = token.split('.')[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join('')
  )

  return JSON.parse(jsonPayload)
}

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
  const signIn = useSignIn()

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
    onSuccess: (res) => {
      if ('isAuthed' in res && res.isAuthed) {
        const token = getCookies()._auth
        const { payload } = parseJwt(token)

        // Signing in
        const signedIn = signIn({
          auth: {
            token,
          },
          userState: payload,
        })

        // Redirecting to home if signed in
        if (signedIn) {
          navigate('/')
        } else {
          console.error('Error signing in:', signedIn)
          return Promise.reject({
            code: 'login.error',
          })
        }
      }
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
