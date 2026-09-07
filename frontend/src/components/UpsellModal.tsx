import { useResDetails } from '@/utils/useResDetails'
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { MobileDialog } from './MobileDialog'

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
    <MobileDialog open={open} onClose={handleClose}>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 1,
        }}
      >
        {t('upsell-modal.title')}
        <IconButton onClick={handleClose} edge="end" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: '1rem' }}>
          {t('upsell-modal.details')}
        </DialogContentText>
      </DialogContent>
      <DialogActions
        sx={{ p: 2, pt: 0, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}
      >
        <Button
          onClick={handleClose}
          fullWidth
          sx={{ order: { xs: 2, sm: 1 } }}
        >
          {t('upsell-modal.cancel')}
        </Button>
        <Button
          component="a"
          href={resDetails?.addonsUrl || ''}
          target="_blank"
          variant="contained"
          fullWidth
          sx={{ order: { xs: 1, sm: 2 } }}
        >
          {t('upsell-modal.buy')}
        </Button>
      </DialogActions>
    </MobileDialog>
  )
}
