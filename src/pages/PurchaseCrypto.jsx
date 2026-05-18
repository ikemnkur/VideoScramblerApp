import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, CardContent,
  Button, Slider, TextField, CircularProgress,
  Alert, Chip, Divider, Grid, IconButton, Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack, ContentCopy, CheckCircle, CloudUpload,
  QrCode2, Refresh, CurrencyBitcoin, ErrorOutline,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import QRCode from 'qrcode';

// ─── Constants ───────────────────────────────────────────────────────────────

const walletAddressMap = {
  BTC: 'bc1q4j9e7equq4xvlyu7tan4gdmkvze7wc0egvykr6',
  LTC: 'ltc1qgg5aggedmvjx0grd2k5shg6jvkdzt9dtcqa4dh',
  SOL: 'qaSpvAumg2L3LLZA8qznFtbrRKYMP1neTGqpNgtCPaU',
  ETH: '0x9a61f30347258A3D03228F363b07692F3CBb7f27',
};

const CURRENCIES = [
  { symbol: 'BTC', name: 'Bitcoin', coinId: 'bitcoin', color: '#f7931a', address: walletAddressMap.BTC },
  { symbol: 'ETH', name: 'Ethereum', coinId: 'ethereum', color: '#627eea', address: walletAddressMap.ETH },
  { symbol: 'LTC', name: 'Litecoin', coinId: 'litecoin', color: '#bfbbbb', address: walletAddressMap.LTC },
  { symbol: 'SOL', name: 'Solana', coinId: 'solana', color: '#9945ff', address: walletAddressMap.SOL },
];

const MIN_USD = 2.5;
const MAX_USD = 250;
const STEP = 0.5;

// Scale anchors: $2.50 → 2,000 | $10 → 10,000 | $95 → 100,000
function creditsForDollars(dollars) {
  if (dollars < MIN_USD) return 0;
  if (dollars <= 10) return Math.round(2000 + (dollars - 2.5) * (8000 / 7.5));
  if (dollars <= 95) return Math.round(10000 + (dollars - 10) * (90000 / 85));
  return Math.round(100000 + (dollars - 95) * (90000 / 85));
}

function bonusPercent(dollars) {
  if (dollars <= 0) return 0;
  const rate = creditsForDollars(dollars) / dollars;
  return Math.round(((rate - 800) / 800) * 100);
}

// ─── Shared sx helpers ───────────────────────────────────────────────────────

const cardSx = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 3,
  mb: 2,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseCrypto() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [amount, setAmount] = useState(10);
  const [currencyIdx, setCurrencyIdx] = useState(0);
  // rates: { bitcoin: 95000, ethereum: 3500, litecoin: 110, solana: 165 }
  const [rates, setRates] = useState({});
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const [senderWallet, setSenderWallet] = useState('');
  const [txHash, setTxHash] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null); // { success, message }

  const currency = CURRENCIES[currencyIdx];
  const credits = creditsForDollars(amount);
  const bonus = bonusPercent(amount);
  const cryptoRate = rates[currency.coinId] ?? null;
  const cryptoAmount = cryptoRate && cryptoRate > 0 ? (amount / cryptoRate).toFixed(6) : null;

  // ── Fetch all four rates at once on mount (and on manual refresh) ────────
  const ALL_COIN_IDS = CURRENCIES.map((c) => c.coinId).join(',');

  const fetchRates = useCallback(async () => {
    setRateLoading(true);
    setRateError(false);
    try {
      // Try server proxy first (avoids CORS / CoinGecko rate-limits)
      const response = await api.get(`/api/crypto-rate?coins=${ALL_COIN_IDS}`);
      setRates(response.data ?? {});
    } catch {
      // Fallback: call CoinGecko directly
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ALL_COIN_IDS}&vs_currencies=usd`
        );
        const data = await res.json();
        setRates(data ?? {});
      } catch {
        setRateError(true);
      }
    } finally {
      setRateLoading(false);
    }
  }, [ALL_COIN_IDS]);

  // Fetch once on mount
  useEffect(() => { fetchRates(); }, [fetchRates]);

  // ── QR code ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (showQr) {
      QRCode.toDataURL(currency.address, { width: 160, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    }
  }, [showQr, currency.address]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(currency.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = async () => {
    if (!user || !txHash.trim() || !senderWallet.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const body = {
        username: user.username,
        currency: currency.symbol,
        amount: Math.round(amount * 100), // cents
        credits,
        transactionId: txHash.trim(),
        walletAddress: senderWallet.trim(),
        cryptoAmount: cryptoAmount || undefined,
      };
      if (screenshot) {
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(screenshot);
        });
        body.screenshot = base64;
      }
      const response = await api.post(`/api/purchases/${user.username}`, body);
      const result = response.data;
      if (result.verified) {
        setSubmitResult({ success: true, message: `Transaction verified! ${result.credits?.toLocaleString()} credits have been added to your account.` });
      } else {
        setSubmitResult({ success: true, message: result.message || 'Submitted for review. Credits will be applied within 24 hours once confirmed.' });
      }
      setTxHash('');
      setScreenshot(null);
      setSenderWallet('');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Submission failed. Please try again.';
      setSubmitResult({ success: false, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>

      {/* Back */}
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/buy-credits')}
        sx={{ color: '#998d8d', mb: 3, textTransform: 'none', '&:hover': { color: '#c2a800' } }}
      >
        Back to payment methods
      </Button>

      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <CurrencyBitcoin sx={{ color: '#f7931a', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'rgb(198,198,198)' }}>
          Buy Credits with Crypto
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: '#998d8d', mb: 3 }}>
        Volume discounts apply — the more you spend, the more credits you receive.
      </Typography>

      {/* ── Amount ── */}
      <Card sx={cardSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="overline" sx={{ color: '#c2a800', letterSpacing: 1.5, fontWeight: 700 }}>
            1. Choose Amount (USD)
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, mb: 1 }}>
            <Typography sx={{ color: '#998d8d', fontSize: 22, fontWeight: 700 }}>$</Typography>
            <TextField
              type="number"
              size="small"
              value={amount}
              inputProps={{ min: MIN_USD, max: MAX_USD, step: STEP }}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (!isNaN(n)) setAmount(Math.min(MAX_USD, Math.max(MIN_USD, Math.round(n / STEP) * STEP)));
              }}
              sx={{
                width: 110,
                '& .MuiOutlinedInput-root': {
                  color: 'rgb(198,198,198)',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  fontSize: 18,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&:hover fieldset': { borderColor: '#c2a800' },
                  '&.Mui-focused fieldset': { borderColor: '#c2a800' },
                },
                '& input': { textAlign: 'center', py: 1 },
              }}
            />
            <Typography variant="caption" sx={{ color: '#998d8d' }}>
              (${MIN_USD} – ${MAX_USD})
            </Typography>
          </Box>

          <Slider
            value={amount}
            min={MIN_USD}
            max={MAX_USD}
            step={STEP}
            onChange={(_, v) => setAmount(v)}
            sx={{
              color: '#c2a800',
              mb: 3,
              '& .MuiSlider-thumb': { width: 18, height: 18, '&:hover': { boxShadow: '0 0 0 8px rgba(194,168,0,0.16)' } },
              '& .MuiSlider-rail': { backgroundColor: 'rgba(255,255,255,0.12)' },
            }}
          />

          {/* Credits display */}
          <Box
            sx={{
              background: bonus > 0 ? 'linear-gradient(135deg, rgba(194,168,0,0.10), rgba(0,230,118,0.06))' : 'rgba(255,255,255,0.04)',
              border: bonus > 0 ? '1px solid rgba(194,168,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 30, color: 'rgb(198,198,198)', lineHeight: 1.1 }}>
                {credits.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#998d8d' }}>credits</Typography>
            </Box>
            {bonus - 25 > 0 && (
              <Chip
                label={`+${bonus - 25}% bonus`}
                size="small"
                sx={{ backgroundColor: 'rgba(194,168,0,0.18)', color: '#c2a800', fontWeight: 700, fontSize: 13 }}
              />
            )}
          </Box>

          {/* Scale reference */}
          <Grid container spacing={1} sx={{ mt: 1.5 }}>
            {[{ usd: '$2.50', cr: '2,000' }, { usd: '$10', cr: '10,000' }, { usd: '$95', cr: '100,000' }].map((pt) => (
              <Grid item xs={4} key={pt.usd}>
                <Box sx={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2, py: 1.5, textAlign: 'center' }}>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'rgb(198,198,198)', fontSize: 13 }}>{pt.usd}</Typography>
                  <Typography variant="caption" sx={{ color: '#998d8d' }}>{pt.cr} cr</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* ── Currency ── */}
      <Card sx={cardSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="overline" sx={{ color: '#c2a800', letterSpacing: 1.5, fontWeight: 700 }}>
            2. Select Currency
          </Typography>

          <Grid container spacing={1} sx={{ mt: 1.5, mb: 2 }}>
            {CURRENCIES.map((c, i) => (
              <Grid item xs={3} key={c.symbol}>
                <Button
                  fullWidth
                  onClick={() => setCurrencyIdx(i)}
                  sx={{
                    py: 1.2,
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: 13,
                    border: currencyIdx === i ? `2px solid ${c.color}` : '2px solid rgba(255,255,255,0.08)',
                    backgroundColor: currencyIdx === i ? `${c.color}22` : 'transparent',
                    color: currencyIdx === i ? c.color : '#998d8d',
                    '&:hover': { backgroundColor: `${c.color}18`, borderColor: c.color, color: c.color },
                  }}
                >
                  {c.symbol}
                </Button>
              </Grid>
            ))}
          </Grid>

          {/* Live rate */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#998d8d' }}>Live rate:</Typography>
              {rateLoading ? (
                <CircularProgress size={14} sx={{ color: '#c2a800' }} />
              ) : rateError ? (
                <Typography variant="body2" sx={{ color: '#f44336' }}>unavailable</Typography>
              ) : cryptoRate ? (
                <Typography variant="body2" sx={{ color: 'rgb(198,198,198)', fontFamily: 'monospace', fontWeight: 700 }}>
                  1 {currency.symbol} = ${cryptoRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Typography>
              ) : null}
            </Box>
            <Button
              size="small"
              startIcon={<Refresh sx={{ fontSize: '14px !important' }} />}
              onClick={fetchRates}
              disabled={rateLoading}
              sx={{ color: '#c2a800', textTransform: 'none', fontSize: 12, minWidth: 0, '&:hover': { backgroundColor: 'rgba(194,168,0,0.08)' } }}
            >
              Refresh
            </Button>
          </Box>

          {cryptoAmount && !rateError && (
            <Box sx={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, p: 2, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#998d8d', display: 'block' }}>Exact amount to send</Typography>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 22, color: currency.color, mt: 0.3 }}>
                {cryptoAmount} {currency.symbol}
              </Typography>
              <Typography variant="caption" sx={{ color: '#998d8d' }}>≈ ${amount.toFixed(2)} USD</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Wallet Address ── */}
      <Card sx={cardSx}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="overline" sx={{ color: '#c2a800', letterSpacing: 1.5, fontWeight: 700 }}>
              3. Send to this {currency.symbol} Address
            </Typography>
            <Tooltip title={showQr ? 'Hide QR' : 'Show QR'}>
              <IconButton
                size="small"
                onClick={() => setShowQr((v) => !v)}
                sx={{
                  color: showQr ? '#c2a800' : '#998d8d',
                  backgroundColor: showQr ? 'rgba(194,168,0,0.12)' : 'transparent',
                  border: '1px solid',
                  borderColor: showQr ? 'rgba(194,168,0,0.3)' : 'rgba(255,255,255,0.08)',
                  '&:hover': { backgroundColor: 'rgba(194,168,0,0.16)', color: '#c2a800' },
                }}
              >
                <QrCode2 sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {showQr && qrDataUrl && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 2, display: 'inline-block' }}>
                <img src={qrDataUrl} alt="Wallet QR code" width={160} height={160} />
              </Box>
            </Box>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              px: 2,
              py: 1.5,
            }}
          >
            <Typography
              sx={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: 'rgb(198,198,198)', wordBreak: 'break-all', lineHeight: 1.6 }}
            >
              {currency.address}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy address'}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  color: copied ? '#00e676' : '#998d8d',
                  flexShrink: 0,
                  '&:hover': { color: '#c2a800', backgroundColor: 'rgba(194,168,0,0.08)' },
                }}
              >
                {copied ? <CheckCircle sx={{ fontSize: 18 }} /> : <ContentCopy sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
          </Box>
          {copied && (
            <Typography variant="caption" sx={{ color: '#00e676', mt: 0.5, display: 'block' }}>
              Address copied to clipboard!
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* ── Transaction Details ── */}
      <Card sx={cardSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="overline" sx={{ color: '#c2a800', letterSpacing: 1.5, fontWeight: 700, display: 'block', mb: 2 }}>
            4. Confirm Your Transaction
          </Typography>

          <Typography variant="body2" sx={{ color: '#998d8d', mb: 2 }}>
            After sending, enter your transaction details below so we can verify and credit your account.
          </Typography>

          <TextField
            fullWidth
            label="Transaction Hash"
            placeholder="0x... or txid..."
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            size="small"
            required
            sx={{ mb: 2, ...textFieldSx }}
          />

          <TextField
            fullWidth
            label="Your Sending Wallet Address"
            placeholder="The wallet you sent from..."
            value={senderWallet}
            onChange={(e) => setSenderWallet(e.target.value)}
            size="small"
            required
            sx={{ mb: 2, ...textFieldSx }}
          />

          {/* Screenshot upload */}
          <Box>
            <Typography variant="caption" sx={{ color: '#998d8d', display: 'block', mb: 1 }}>
              Screenshot (optional, helps verification)
            </Typography>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUpload />}
              fullWidth
              sx={{
                borderColor: 'rgba(255,255,255,0.12)',
                color: screenshot ? '#00e676' : '#998d8d',
                textTransform: 'none',
                justifyContent: 'flex-start',
                px: 2,
                py: 1.2,
                borderRadius: 2,
                '&:hover': { borderColor: '#c2a800', color: '#c2a800', backgroundColor: 'rgba(194,168,0,0.06)' },
              }}
            >
              {screenshot ? screenshot.name : 'Upload payment confirmation'}
              <input type="file" accept="image/*" hidden onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)} />
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Submit result */}
      {submitResult && (
        <Alert
          severity={submitResult.success ? 'success' : 'error'}
          icon={submitResult.success ? <CheckCircle /> : <ErrorOutline />}
          sx={{
            mb: 2,
            backgroundColor: submitResult.success ? 'rgba(0,230,118,0.08)' : 'rgba(244,67,54,0.08)',
            border: `1px solid ${submitResult.success ? 'rgba(0,230,118,0.25)' : 'rgba(244,67,54,0.25)'}`,
            color: submitResult.success ? '#00e676' : '#f44336',
            borderRadius: 2,
            '& .MuiAlert-icon': { color: submitResult.success ? '#00e676' : '#f44336' },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.3 }}>
            {submitResult.success ? 'Order Submitted' : 'Submission Failed'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>{submitResult.message}</Typography>
        </Alert>
      )}

      {/* Submit button */}
      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={handleSubmit}
        disabled={submitting || !txHash.trim() || !senderWallet.trim()}
        sx={{
          py: 1.8,
          fontWeight: 800,
          fontSize: 15,
          borderRadius: 2,
          textTransform: 'none',
          background: 'linear-gradient(90deg, #c2a800, #e0c800)',
          color: '#0a0a0a',
          boxShadow: '0 4px 20px rgba(194,168,0,0.3)',
          '&:hover': { background: 'linear-gradient(90deg, #d4bb00, #f0d800)', boxShadow: '0 6px 24px rgba(194,168,0,0.45)' },
          '&:disabled': { background: 'rgba(255,255,255,0.08)', color: '#555', boxShadow: 'none' },
        }}
      >
        {submitting ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={18} sx={{ color: '#0a0a0a' }} />
            Submitting...
          </Box>
        ) : (
          `Submit Order — ${credits.toLocaleString()} credits`
        )}
      </Button>

      <Typography variant="caption" sx={{ color: '#555', display: 'block', textAlign: 'center', mt: 2 }}>
        Credits are applied automatically once your transaction is detected on-chain, or within 24 hours after manual review.
      </Typography>

    </Container>
  );
}

// ── Shared TextField sx ───────────────────────────────────────────────────────
const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'rgb(198,198,198)',
    fontFamily: 'monospace',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: '#c2a800' },
    '&.Mui-focused fieldset': { borderColor: '#c2a800' },
  },
  '& .MuiInputLabel-root': { color: '#998d8d' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#c2a800' },
};
