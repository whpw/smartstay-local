import { useResDetails } from '@/utils/useResDetails'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { AppDialog } from './AppDialog'

export const UpsellModal = ({
  open,
  handleClose,
  paymentDue = false,
}: {
  open: boolean
  handleClose: () => void
  /** Start refused because the reservation has an unpaid balance. */
  paymentDue?: boolean
}) => {
  const { t } = useTranslation()
  const resDetails = useResDetails()

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title={t(
        paymentDue ? 'upsell-modal.payment-due-title' : 'upsell-modal.title',
      )}
      actions={
        <>
          <Button onClick={handleClose}>{t('upsell-modal.cancel')}</Button>
          <Button
            component="a"
            href={resDetails?.addonsUrl || ''}
            target="_blank"
            variant="contained"
          >
            {t(
              paymentDue ? 'upsell-modal.payment-due-pay' : 'upsell-modal.buy',
            )}
          </Button>
        </>
      }
    >
      <Typography color="text.secondary">
        {t(
          paymentDue
            ? 'upsell-modal.payment-due-details'
            : 'upsell-modal.details',
        )}
      </Typography>
    </AppDialog>
  )
}
