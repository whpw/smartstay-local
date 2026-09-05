import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined'
import { Box, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const PollingErrorCover = () => {
  const { t } = useTranslation()
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(28, 25, 23, 0.55)',
        backdropFilter: 'blur(6px)',
        color: '#FFFCF7',
        px: 2,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <ErrorOutlinedIcon />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t('devices.polling-error')}
        </Typography>
      </Stack>
    </Box>
  )
}
