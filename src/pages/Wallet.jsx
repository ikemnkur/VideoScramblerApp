import React, { useEffect, useState } from 'react';
import {
  Button,
  Container,
  Stack,
  Typography,
  Card,
  CardContent,
  Divider,
  Skeleton,
  Box,
  Grid,
  Paper
} from '@mui/material';
import {
  CreditCard,
  AccountBalanceWallet,
  CurrencyBitcoin,
  Payment,
  Star,
  Timer,
  AttachMoney
} from '@mui/icons-material';
// import Button from '../components/Button';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';


import { useNavigate } from 'react-router-dom';


export default function Wallet() {
  const [balance, setBalance] = useState(null);
  const { success, error } = useToast();

  const [ud, setUd] = useState(JSON.parse(localStorage.getItem("userdata")));

  const navigate = useNavigate();


  const load = async () => {
    try {
      const { data } = await api.post(`/api/wallet/balance/${ud.username}`, { Password: ud.password, email: ud.email });
      setBalance(data?.balance ?? 0);
    } catch (e) {
      console.error(e);
      setBalance(100); // demo fallback
    }
  };

  useEffect(() => { load(); }, []);

  const onPaymentError = () => error('Payment could not be started');

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" color="secondary.main">Wallet</Typography>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Current Balance</Typography>
            {balance === null ? (
              <Skeleton variant="text" width={220} height={54} />
            ) : (
              <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main' }}>{balance} credits</Typography>
            )}


            <Divider sx={{ my: 3 }} />

            {/* One-time Purchases Section */}
            <Box>
              <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timer color="secondary" />
                One-time Purchases
              </Typography>

              <Grid container spacing={2}>
                {/* Stripe One-time */}
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#424242' }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1, color: 'white' }}>
                      <CreditCard color="primary" />
                      Stripe
                    </Typography>
                    <Button
                      amountUSD={10}
                      // onError={onPaymentError}
                      onClick={() => navigate('/purchase-stripe')}
                      sx={{
                        backgroundColor: '#635bff',
                        color: 'white',
                        '&:hover': { backgroundColor: '#5248e8' },
                        width: '100%',
                        mb: 1
                      }}
                    >
                      $2.5 - 20 Credits
                    </Button>
                  </Paper>
                </Grid>

                {/* PayPal One-time */}
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#424242' }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1, color: 'white' }}>
                      <Payment sx={{ color: '#0070ba' }} />
                      PayPal
                    </Typography>
                    <Button
                      paymentMethod="paypal"
                      amountUSD={10}
                      onClick={() => navigate('/purchase-paypal')}
                      // onError={onPaymentError}
                      sx={{
                        backgroundColor: '#0070ba',
                        color: 'white',
                        '&:hover': { backgroundColor: '#005ea6' },
                        width: '100%',
                        mb: 1
                      }}
                    >
                      $5-10 Credits
                    </Button>
                  </Paper>
                </Grid>

                {/* Crypto One-time */}
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#424242' }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1, color: 'white' }}>
                      <CurrencyBitcoin sx={{ color: '#f7931a' }} />
                      Crypto
                    </Typography>
                    <Button
                      paymentMethod="crypto"
                      amountUSD={10}
                      onClick={() => navigate('/purchase-crypto')}
                      // onError={onPaymentError}
                      sx={{
                        backgroundColor: '#f7931a',
                        color: 'white',
                        '&:hover': { backgroundColor: '#e88916' },
                        width: '100%',
                        mb: 1
                      }}
                    >
                      $1-25 Credits
                    </Button>
                  </Paper>
                </Grid>

                {/* CashApp One-time */}
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#424242' }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1, color: 'white' }}>
                      <AttachMoney sx={{ color: '#00d632' }} />
                      CashApp
                    </Typography>
                    <Button
                      paymentMethod="cashapp"
                      amountUSD={10}
                      onClick={() => navigate('/purchase-cashapp')}
                      onError={onPaymentError}
                      sx={{
                        backgroundColor: '#00d632',
                        color: 'white',
                        '&:hover': { backgroundColor: '#00c42e' },
                        width: '100%',
                        mb: 1
                      }}
                    >
                      $5-25 Credits
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            </Box>

          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}