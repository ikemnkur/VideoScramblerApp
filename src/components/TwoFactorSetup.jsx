// src/components/TwoFactorSetup.jsx
// Provides a UI for users to set up or disable TOTP-based 2FA from their Account settings.
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import KeyIcon from '@mui/icons-material/Key';

const TwoFactorSetup = () => {
  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

  const [status, setStatus] = useState(null); // null | 'setup' | 'enabling' | 'disabling'
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [entryMode, setEntryMode] = useState('qr'); // 'qr' | 'manual'
  const [copied, setCopied] = useState(false);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  // Fetch current 2FA status
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/2fa/status`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success) setTwoFactorEnabled(!!data.twoFactorEnabled);
      } catch {
        setError('Could not load 2FA status.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleSetup = async () => {
    setError('');
    setMessage('');
    setStatus('setup');
    setCode('');
    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Setup failed');
        setStatus(null);
        return;
      }
      setQrCode(data.qrCode);
      setSecret(data.secret);
    } catch {
      setError('Network error. Please try again.');
      setStatus(null);
    }
  };

  const handleEnable = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError('');
    setStatus('enabling');
    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/enable`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Could not enable 2FA.');
        setStatus('setup');
        return;
      }
      setTwoFactorEnabled(true);
      setRecoveryCodes(data.recoveryCodes || []);
      setMessage('2FA enabled! Save your recovery codes below.');
      setStatus('done');
      setQrCode('');
      setSecret('');
      setCode('');
    } catch {
      setError('Network error. Please try again.');
      setStatus('setup');
    }
  };

  const handleDisable = async () => {
    if (code.length !== 6) {
      setError('Enter your current 6-digit TOTP code to confirm.');
      return;
    }
    setError('');
    setStatus('disabling');
    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Could not disable 2FA.');
        setStatus('disabling_input');
        return;
      }
      setTwoFactorEnabled(false);
      setMessage('2FA has been disabled.');
      setStatus(null);
      setCode('');
      setRecoveryCodes([]);
    } catch {
      setError('Network error. Please try again.');
      setStatus('disabling_input');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, mt: 3, border: '1px solid #58585872', borderRadius: 2, background: '#2a2a2acc' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SecurityIcon sx={{ color: '#ffd700' }} />
        <Typography variant="h6" sx={{ color: '#ffd700', fontWeight: 700 }}>
          Two-Factor Authentication (2FA)
        </Typography>
        <Chip
          label={twoFactorEnabled ? 'Enabled' : 'Disabled'}
          size="small"
          sx={{
            ml: 1,
            bgcolor: twoFactorEnabled ? '#2e7d32' : '#555',
            color: '#fff',
            fontWeight: 600,
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: '#ccc', mb: 1 }}>
        Add a second layer of security using any TOTP authenticator app — works with:
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {[
          { label: 'Google Authenticator', href: 'https://support.google.com/accounts/answer/1066447' },
          { label: 'Authy', href: 'https://authy.com/download/' },
          { label: 'Microsoft Authenticator', href: 'https://www.microsoft.com/en-us/security/mobile-authenticator-app' },
          { label: '1Password', href: 'https://1password.com/' },
        ].map(({ label, href }) => (
          <Chip
            key={label}
            label={label}
            size="small"
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            sx={{ bgcolor: '#2a2a2a', color: '#90caf9', border: '1px solid #444', fontSize: 11 }}
          />
        ))}
      </Stack>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Recovery codes display after enabling */}
      {recoveryCodes.length > 0 && (
        <Box sx={{ mb: 3, p: 2, border: '1px solid #ffd700', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: '#ffd700', fontWeight: 700, mb: 1 }}>
            Recovery Codes — save these somewhere safe!
          </Typography>
          <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1 }}>
            Each code can be used once if you lose access to your authenticator app.
          </Typography>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              color: '#fff',
              lineHeight: 1.8,
              m: 0,
              userSelect: 'all',
            }}
          >
            {recoveryCodes.join('\n')}
          </Box>
        </Box>
      )}

      {/* ---- 2FA not yet enabled ---- */}
      {!twoFactorEnabled && !status && (
        <Button variant="contained" onClick={handleSetup} sx={{ bgcolor: '#ffd700', color: '#000', '&:hover': { bgcolor: '#ffe066' } }}>
          Set Up 2FA
        </Button>
      )}

      {/* ---- Setup: show QR code and confirm code ---- */}
      {!twoFactorEnabled && status === 'setup' && (
        <Box>
          {/* Step-by-step instructions */}
          <Box sx={{ mb: 2, p: 2, bgcolor: '#111', borderRadius: 1, border: '1px solid #333' }}>
            <Typography variant="body2" sx={{ color: '#ffd700', fontWeight: 700, mb: 1 }}>
              How to set up (3 easy steps)
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc', mb: 0.5 }}>
              1. Install an authenticator app on your phone (Google Authenticator, Authy, etc.)
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc', mb: 0.5 }}>
              2. Add a new account — scan the QR code <em>or</em> paste the key manually.
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc' }}>
              3. Enter the 6-digit code the app shows below and click <strong>Activate</strong>.
            </Typography>
          </Box>

          {/* QR / Manual toggle */}
          <ToggleButtonGroup
            value={entryMode}
            exclusive
            onChange={(_, v) => { if (v) setEntryMode(v); }}
            size="small"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="qr" sx={{ color: '#ccc', '&.Mui-selected': { color: '#000', bgcolor: '#ffd700' } }}>
              <QrCode2Icon sx={{ mr: 0.5, fontSize: 18 }} /> Scan QR code
            </ToggleButton>
            <ToggleButton value="manual" sx={{ color: '#ccc', '&.Mui-selected': { color: '#000', bgcolor: '#ffd700' } }}>
              <KeyIcon sx={{ mr: 0.5, fontSize: 18 }} /> Enter key manually
            </ToggleButton>
          </ToggleButtonGroup>

          {/* QR code view */}
          {entryMode === 'qr' && qrCode && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1 }}>
                Open your authenticator app → tap <strong>+</strong> → <em>Scan QR code</em>
              </Typography>
              <img src={qrCode} alt="2FA QR code" style={{ width: 200, height: 200, border: '4px solid #ffd700', borderRadius: 8 }} />
            </Box>
          )}

          {/* Manual key view */}
          {entryMode === 'manual' && secret && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#111', borderRadius: 1, border: '1px solid #444' }}>
              <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1 }}>
                Open your authenticator app → tap <strong>+</strong> → <em>Enter setup key</em> → paste the key below.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body1"
                  sx={{ fontFamily: 'monospace', color: '#ffd700', letterSpacing: 3, flex: 1, wordBreak: 'break-all' }}
                >
                  {secret}
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy key'} placement="top">
                  <IconButton size="small" onClick={copySecret} sx={{ color: copied ? '#4caf50' : '#aaa' }}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" sx={{ color: '#777', mt: 1, display: 'block' }}>
                Time-based (TOTP) · Account name: VideoScrambler
              </Typography>
            </Box>
          )}

          {/* Code entry */}
          <TextField
            label="6-digit code from your app"
            variant="outlined"
            fullWidth
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ inputMode: 'numeric', maxLength: 6 }}
            sx={{ mb: 2 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEnable(); }}
            autoFocus
            helperText="The code refreshes every 30 seconds — enter it quickly."
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleEnable}
              disabled={code.length !== 6}
              sx={{ bgcolor: '#ffd700', color: '#000', '&:hover': { bgcolor: '#ffe066' } }}
            >
              Activate 2FA
            </Button>
            <Button variant="outlined" onClick={() => { setStatus(null); setQrCode(''); setSecret(''); setCode(''); setError(''); }}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}

      {/* ---- Enabling spinner ---- */}
      {status === 'enabling' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" sx={{ color: '#ccc' }}>Activating…</Typography>
        </Box>
      )}

      {/* ---- 2FA is enabled: show disable option ---- */}
      {twoFactorEnabled && !['disabling_input', 'disabling'].includes(status) && status !== 'done' && (
        <Box>
          <Divider sx={{ mb: 2, borderColor: '#333' }} />
          <Typography variant="body2" sx={{ color: '#ccc', mb: 1 }}>
            2FA is active on your account. To disable it, enter your current authenticator code below.
          </Typography>
          <TextField
            label="Current 6-digit code"
            variant="outlined"
            fullWidth
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ inputMode: 'numeric', maxLength: 6 }}
            sx={{ mb: 2 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleDisable(); }}
          />
          <Button
            variant="outlined"
            color="error"
            onClick={handleDisable}
            disabled={code.length !== 6}
          >
            Disable 2FA
          </Button>
        </Box>
      )}

      {/* ---- Disabling spinner ---- */}
      {status === 'disabling' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" sx={{ color: '#ccc' }}>Disabling…</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default TwoFactorSetup;
