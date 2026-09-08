import { useResDetails } from '@/utils/useResDetails'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { AppDialog } from './AppDialog'

export const UpsellModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const { t } = useTranslation()
  const resDetails = useResDetails()

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title={t('upsell-modal.title')}
      actions={
        <>
          <Button onClick={handleClose}>{t('upsell-modal.cancel')}</Button>
          <Button
            component="a"
            href={resDetails?.addonsUrl || ''}
            target="_blank"
            variant="contained"
          >
            {t('upsell-modal.buy')}
          </Button>
        </>
      }
    >
      <Typography color="text.secondary">
        {t('upsell-modal.details')}
      </Typography>
    </AppDialog>
  )
}
