import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined'
import { Box, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const PollingErrorCover = () => {
  const { t } = useTranslation()
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
      }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <ErrorOutlinedIcon />
        <Typography variant="body2">{t('devices.polling-error')}</Typography>
      </Stack>
    </Box>
  )
}
