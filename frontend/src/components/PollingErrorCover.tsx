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
        backgroundColor: 'rgba(26, 26, 26, 0.55)',
        backdropFilter: 'blur(4px)',
        color: 'white',
        borderRadius: 'inherit',
        zIndex: 1,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
          px: 2,
          py: 1.5,
          bgcolor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 2,
        }}
      >
        <ErrorOutlinedIcon fontSize="small" />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {t('devices.polling-error')}
        </Typography>
      </Stack>
    </Box>
  )
}
