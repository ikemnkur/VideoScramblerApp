import React, { useEffect, useState } from 'react';
import { Container, Stack, Typography, Card, CardContent, Divider, Skeleton } from '@mui/material';
import PaymentButton from '../components/PaymentButton';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function Wallet(){
  const [balance, setBalance] = useState(null);
  const { success, error } = useToast();

  const load = async ()=>{
    try{
      const { data } = await api.get('/wallet/balance');
      setBalance(data?.balance ?? 0);
    }catch(e){
      console.error(e);
      setBalance(100); // demo fallback
    }
  };

  useEffect(()=>{ load(); },[]);

  const onPaymentError = () => error('Payment could not be started');

  return (
    <Container sx={{py:4}}>
      <Stack spacing={2}>
        <Typography variant="h4" color="secondary.main">Wallet</Typography>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Current Balance</Typography>
            {balance === null ? (
              <Skeleton variant="text" width={220} height={54} />
            ) : (
              <Typography variant="h3" sx={{fontWeight:800, color:'primary.main'}}>{balance} credits</Typography>
            )}
            <Divider sx={{my:2}}/>
            <PaymentButton amountUSD={10} onError={onPaymentError}>Add $10 in Credits</PaymentButton>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}