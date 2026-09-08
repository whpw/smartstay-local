import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import type { ReactNode } from 'react'

export const AppDialog = ({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  actions?: ReactNode
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <Box
        aria-hidden
        sx={{
          display: { xs: 'flex', sm: 'none' },
          justifyContent: 'center',
          pt: 1.25,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: 99,
            bgcolor: 'text.disabled',
            opacity: 0.45,
          }}
        />
      </Box>
      <DialogTitle sx={{ pt: { xs: 1.5, sm: 3 } }}>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      {actions ? <DialogActions>{actions}</DialogActions> : null}
    </Dialog>
  )
}
