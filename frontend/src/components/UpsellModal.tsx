import { useResDetails } from '@/utils/useResDetails'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useTranslation } from 'react-i18next'

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
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{t('upsell-modal.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('upsell-modal.details')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('upsell-modal.cancel')}</Button>
        <Button
          component="a"
          href={resDetails?.addonsUrl || ''}
          target="_blank"
          variant="contained"
        >
          {t('upsell-modal.buy')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
