import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { HourglassEmpty, Warning } from '@mui/icons-material';

export default function ProcessingModal({ open, mediaType = 'media' }) {
  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      onClose={(event, reason) => {
        // Prevent closing on backdrop click or escape key
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
      }}
    >
      <DialogContent sx={{ backgroundColor: '#424242', color: 'white', py: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <CircularProgress size={60} sx={{ color: '#22d3ee' }} />
        </Box>

        <HourglassEmpty sx={{ fontSize: 48, color: '#22d3ee', mb: 2 }} />

        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: 'white' }}>
          Processing Your {mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} File...
        </Typography>

        <Typography variant="body1" sx={{ color: '#e0e0e0', mb: 3 }}>
          Please wait while we process your file. This may take a few moments depending on the file size.
        </Typography>

        <Alert 
          severity="warning" 
          icon={<Warning />}
          sx={{ 
            backgroundColor: '#ff9800', 
            color: 'white',
            '& .MuiAlert-icon': { color: 'white' }
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            ⚠️ DO NOT CLOSE THIS WINDOW!
          </Typography>
          <Typography variant="body2">
            Closing this window will interrupt the process and may result in file loss or corruption during transmission.
          </Typography>
        </Alert>

        <Box sx={{ mt: 3, p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
          <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
            💡 Tip: The processing time depends on your file size and selected settings. 
            Larger files or complex operations may take longer.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
