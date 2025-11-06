import React, { useEffect, useState } from 'react';
import { 
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
import PaymentButton from '../components/PaymentButton';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function Wallet() {
  const [balance, setBalance] = useState(null);
  const { success, error } = useToast();

  const load = async () => {
    try {
      const { data } = await api.get('/wallet/balance');
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
        <Typography variant="h4" color="secondary.main">Account Membership Overview</Typography>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Current Account Tier</Typography>
            {balance === null ? (
              <Skeleton variant="text" width={220} height={54} />
            ) : (
              <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main' }}> Free </Typography>
            )}
            <Divider sx={{ my: 2 }} />
            
            {/* Subscription Plans Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Star color="primary" />
                Subscribe & Save
              </Typography>
              
              <Grid container spacing={2}>
                {/* Stripe Subscription */}
                <Grid item xs={12} md={6}>
                  <Paper elevation={2} sx={{ p: 2, border: '2px solid', borderColor: 'primary.main', backgroundColor: '#424242' }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'white' }}>
                      <CreditCard color="primary" />
                      Stripe
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
                      Subscribe with Stripe and get 1250 bonus credits monthly!
                    </Typography>
                    <Stack spacing={1}>
                      <PaymentButton 
                        amountUSD={10} 
                        onError={onPaymentError}
                        sx={{ 
                          backgroundColor: '#635bff',
                          color: 'white',
                          '&:hover': { backgroundColor: '#5248e8' },
                          fontWeight: 'bold'
                        }}
                      >
                        Premium Plan - $10/month
                      </PaymentButton>
                      <PaymentButton 
                        amountUSD={5} 
                        onError={onPaymentError}
                        sx={{ 
                          backgroundColor: '#4f46e5',
                          color: 'white',
                          '&:hover': { backgroundColor: '#4338ca' },
                          fontWeight: 'bold'
                        }}
                      >
                        Standard Plan - $5/month
                      </PaymentButton>

                      <PaymentButton 
                        amountUSD={5} 
                        onError={onPaymentError}
                        sx={{ 
                          backgroundColor: '#009cde',
                          color: 'white',
                          '&:hover': { backgroundColor: '#0087c7' },
                          fontWeight: 'bold'
                        }}
                      >
                        Basic Plan (No ads) - $2.50/month
                      </PaymentButton>
                    </Stack>
                  </Paper>
                </Grid>

                {/* PayPal Subscription */}
                {/* <Grid item xs={12} md={6}>
                  <Paper elevation={2} sx={{ p: 2, border: '2px solid', borderColor: '#0070ba', backgroundColor: '#424242' }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'white' }}>
                      <Payment sx={{ color: '#0070ba' }} />
                      PayPal
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
                      Subscribe with PayPal and get 1000 bonus credits monthly!
                    </Typography>
                    <Stack spacing={1}>
                      <PaymentButton 
                        amountUSD={10} 
                        onError={onPaymentError}
                        sx={{ 
                          backgroundColor: '#0070ba',
                          color: 'white',
                          '&:hover': { backgroundColor: '#005ea6' },
                          fontWeight: 'bold'
                        }}
                      >
                        Premium Plan - $10/month
                      </PaymentButton>
                      <PaymentButton 
                        amountUSD={5} 
                        onError={onPaymentError}
                        sx={{ 
                          backgroundColor: '#009cde',
                          color: 'white',
                          '&:hover': { backgroundColor: '#0087c7' },
                          fontWeight: 'bold'
                        }}
                      >
                        Standard Plan - $5/month
                      </PaymentButton>
                      <PaymentButton 
                        amountUSD={5} 
                        onError={onPaymentError}
                        sx={{ 
                          backgroundColor: '#009cde',
                          color: 'white',
                          '&:hover': { backgroundColor: '#0087c7' },
                          fontWeight: 'bold'
                        }}
                      >
                        Basic Plan (No ads) - $2.50/month
                      </PaymentButton>
                    </Stack>
                  </Paper>
                </Grid> */}
              </Grid>

            </Box>
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney color="secondary" />
                Unsubscribe from Plans
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
                To unsubscribe from your current subscription plan, please visit the respective payment provider's website (Stripe or PayPal) and manage your subscriptions there.
                Inactive account's (60 days) subscriptions will not renew automatically, and will be deleted in 90 days.
              </Typography>
            </Box>

          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}