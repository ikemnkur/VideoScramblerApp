import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Stack, 
  Typography, 
  IconButton,
  Box,
  Divider
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SecurityIcon from '@mui/icons-material/Security';
import { useToast } from '../contexts/ToastContext';

export default function KeyRevealDialog({ open, onClose, title = 'Your key', value }){
  const { success } = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || '');
      setCopied(true);
      success('Copied to clipboard');
      setTimeout(()=>setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1a1a1a',
          border: '2px solid #ffd700',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(255, 215, 0, 0.2)',
          color: '#ffffff'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          backgroundColor: '#0a0a0a',
          color: '#ffd700',
          fontWeight: 700,
          fontSize: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #444'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon />
          {title}
        </Box>
        <IconButton 
          onClick={onClose}
          sx={{ 
            color: '#ffd700',
            '&:hover': {
              backgroundColor: 'rgba(255, 215, 0, 0.1)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ backgroundColor: '#1a1a1a', py: 3 }}>
        <Stack spacing={3}>
          <br></br>
          <Box 
            sx={{ 
              p: 2, 
              backgroundColor: '#2a2a2a', 
              borderRadius: 2,
              border: '1px solid #444',
              textAlign: 'center'
            }}
          >
            <SecurityIcon sx={{ color: '#ffd700', fontSize: '2rem', mb: 1 }} />
            <Typography variant="body2" sx={{ color: '#b0b0b0', fontWeight: 500 }}>
              🔐 Store this securely. Treat it like a password.
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 1 }}>
              This key will only be shown once for security reasons.
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#ffd700', mb: 1, fontWeight: 600 }}>
              Your Key:
            </Typography>
            <TextField 
              value={value || ''} 
              fullWidth 
              multiline 
              rows={3}
              InputProps={{ 
                readOnly: true,
                sx: {
                  backgroundColor: '#0a0a0a',
                  border: '2px solid #ffd700',
                  borderRadius: 2,
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  color: '#ffd700',
                  '& .MuiInputBase-input': {
                    color: '#ffd700',
                    fontWeight: 600,
                    textAlign: 'center',
                    padding: '16px',
                    userSelect: 'all'
                  },
                  '&:hover': {
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)'
                  },
                  '&.Mui-focused': {
                    boxShadow: '0 0 15px rgba(255, 215, 0, 0.5)'
                  }
                }
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      
      <DialogActions 
        sx={{ 
          backgroundColor: '#0a0a0a', 
          borderTop: '1px solid #444',
          p: 3,
          gap: 2
        }}
      >
        <Button 
          onClick={copy} 
          variant="contained"
          startIcon={copied ? <CheckIcon/> : <ContentCopyIcon/>}
          sx={{
            backgroundColor: copied ? '#2e7d32' : '#ffd700',
            color: copied ? '#fff' : '#000',
            fontWeight: 600,
            px: 3,
            py: 1,
            '&:hover': {
              backgroundColor: copied ? '#1b5e20' : '#ffed4e',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)'
            },
            '&:disabled': {
              backgroundColor: '#444',
              color: '#888'
            }
          }}
        >
          {copied ? 'Copied!' : 'Copy Key'}
        </Button>
        
        <Button 
          onClick={onClose} 
          variant="outlined"
          sx={{
            borderColor: '#666',
            color: '#b0b0b0',
            px: 3,
            py: 1,
            '&:hover': {
              borderColor: '#ffd700',
              color: '#ffd700',
              backgroundColor: 'rgba(255, 215, 0, 0.1)'
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}