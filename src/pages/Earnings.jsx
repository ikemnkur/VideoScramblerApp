import React, { useEffect, useState } from 'react';
import { Container, Stack, Typography, Card, CardContent, Divider, Skeleton } from '@mui/material';
import PaymentButton from '../components/PaymentButton';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import SellerTransactions from '../components/SellerTransactions';

export default function Wallet(){
  const [balance, setBalance] = useState(null);
  const { success, error } = useToast();

  // const load = async ()=>{
  //   try{
  //     const { data } = await api.get('/wallet/balance');
  //     setBalance(data?.balance ?? 0);
  //   }catch(e){
  //     console.error(e);
  //     setBalance(100); // demo fallback
  //   }
  // };

  // useEffect(()=>{ load(); },[]);

  const onPaymentError = () => error('Payment could not be started');

  return (
    <Container sx={{py:4}}>
      <Stack spacing={2}>
        {/* <Typography variant="h4" color="secondary.main">Earnings</Typography>
        <Card variant="outlined">
          <CardContent> */}
           
            <SellerTransactions />
          {/* </CardContent> */}
        {/* </Card> */}
      </Stack>
    </Container>
  );
}