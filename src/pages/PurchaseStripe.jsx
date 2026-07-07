import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Box,
  Paper,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  CreditCard,
  LocalOffer,
  TrendingUp,
  CheckCircle,
  OpenInNew,
  Warning,
} from '@mui/icons-material';

import Stripe from "../components/Stripe";
import api from '../api/client';

const PACKAGES = [
  { credits: 2500, dollars: 2.5, label: "$2.50", color: '#4caf50', priceId: 'price_1SR9nNEViYxfJNd2pijdhiBM' },
  { credits: 5250, dollars: 5, label: "$5.00", color: '#2196f3', priceId: 'price_1SR9lZEViYxfJNd20x2uwukQ' },
  { credits: 11200, dollars: 10, label: "$10.00", color: '#9c27b0', priceId: 'price_1SR9kzEViYxfJNd27aLA7kFW' },
  { credits: 26000, dollars: 20, label: "$20.00", color: '#f57c00', popular: true, priceId: 'price_1SR9mrEViYxfJNd2dD5NHFoL' },
];

// Incentive multipliers by package amount (bigger packages get larger bonus)
const MULTIPLIERS = {
  2.5: 1.00, // no bonus
  5: 1.05,   // 5% bonus
  10: 1.12,  // 12% bonus
  20: 1.30,  // 30% bonus
};


function computePackageInfo(dollars, amountOfCredits) {
  const multiplier = MULTIPLIERS[dollars] || 1;
  const credits = Math.round(dollars * 1000 * multiplier);
  const effectivePricePer1000 = dollars / (credits / 1000); // $ per 1000 credits
  const discountPercent = Math.max(0, Math.round((1 - effectivePricePer1000) * 100));
  const bonusCredits = credits - Math.round(dollars * 1000);
  return { dollars, credits, multiplier, effectivePricePer1000, discountPercent, bonusCredits };
}

export default function PurchaseStripe() {
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingPackage, setPendingPackage] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [userData, setUserData] = useState(() => {
    const stored = localStorage.getItem('userdata');
    return stored ? JSON.parse(stored) : {};
  });

  const [balance, setBalance] = useState(0);


  const packageInfos = PACKAGES.map(p => ({
    ...computePackageInfo(p.dollars, p.credits),
    color: p.color,
    popular: p.popular,
    priceId: p.priceId
  }));

  function handleSelect(pkgInfo) {
    setMessage(null);
    setSelected(pkgInfo);
  }

  function handleOpenStripePaymentPage(pkgInfo) {
    setMessage(null);
    setPendingPackage(pkgInfo);
    setShowModal(true);
  }

  const load = async () => {
    try {
      const { data } = await api.post(`/api/wallet/balance/${userData.username}`, { Password: userData.password, email: userData.email });
      setBalance(data?.balance ?? 0);
    } catch (e) {
      console.error(e);
      setBalance(1001); // demo fallback
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleConfirmPayment() {
    if (!pendingPackage) return;
    setIsRedirecting(true);
    setShowModal(false);
    try {
      const response = await api.post('/api/stripe-purchase/create-checkout', {
        userId:   userData.id,
        username: userData.username,
        email:    userData.email,
        priceId:  pendingPackage.priceId,
        credits:  pendingPackage.credits,
        dollars:  pendingPackage.dollars,
        label:    pendingPackage.label || `$${pendingPackage.dollars.toFixed(2)}`,
      });
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error(response.data?.message || 'No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setMessage('Failed to start checkout. Please try again.');
      setIsRedirecting(false);
    }
  }

  function handleCancelPayment() {
    setShowModal(false);
    setPendingPackage(null);
  }

  function handleSuccess(sessionOrResult) {
    setMessage('Payment successful — credits will appear in your account shortly.');
    setSelected(null);
  }

  return (
    <Container sx={{ py: 4 }}>
      {/* Header Section */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <CreditCard />
          Buy Credits
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Base rate: 1000 credits = $1. Larger packages include bonus credits — better value per 1000 credits.
        </Typography>
      </Box>

      {/* Package Selection */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {packageInfos.map((pkg) => (
          <Grid item xs={12} sm={6} md={3} key={pkg.dollars}>
            <Card
              elevation={pkg.popular ? 8 : 2}
              sx={{
                height: '100%',
                position: 'relative',
                border: selected === pkg ? '3px solid' : (pkg.popular ? '2px solid' : 'none'),
                borderColor: selected === pkg ? pkg.color : (pkg.popular ? 'primary.main' : 'transparent'),
                backgroundColor: '#424242',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
              onClick={() => handleSelect(pkg)}
            >
              {pkg.popular && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'primary.main',
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <TrendingUp fontSize="small" />
                  <Typography variant="caption" fontWeight="bold" sx={{ paddingTop: '5px' }}>
                    BEST VALUE
                  </Typography>
                </Box>
              )}

              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: pkg.color, mb: 1 }}>
                  {pkg.dollars.toFixed(2)} USD
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {pkg.credits.toLocaleString()} Credits
                  </Typography>
                  {/* {pkg.bonusCredits > 0 && ( */}
                  <Chip
                    icon={<LocalOffer />}
                    label={`+${pkg.bonusCredits.toLocaleString()} Bonus`}
                    size="small"
                    sx={{
                      mt: 1,
                      backgroundColor: pkg.color,
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                  {/* )} */}
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Effective Rate
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: pkg.color }}>
                    ${pkg.effectivePricePer1000.toFixed(2)} per 1000 credits
                  </Typography>
                </Box>

                {/* {pkg.discountPercent > 0 && ( */}
                <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold', mb: 2 }}>
                  Save {pkg.discountPercent}% vs base rate
                </Typography>
                {/* )} */}

                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    backgroundColor: selected === pkg ? '#2e7d32' : pkg.color,
                    color: 'white',
                    fontWeight: 'bold',
                    '&:hover': {
                      backgroundColor: selected === pkg ? '#2e7d32' : pkg.color,
                      opacity: 0.9,
                    },
                  }}
                  onClick={() => handleOpenStripePaymentPage(pkg)}
                >
                  {selected === pkg ? (
                    <>
                      <CheckCircle sx={{ mr: 1 }} />
                      Selected
                    </>
                  ) : (
                    'Select Package'
                  )}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Checkout Section */}
      {selected && 0 && (
        <Paper elevation={4} sx={{ p: 4, backgroundColor: '#424242', color: 'white' }}>
          <Typography variant="h4" sx={{ mb: 2, color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CreditCard />
            Checkout — {selected.dollars.toFixed(2)} USD
          </Typography>

          <Typography variant="body1" sx={{ mb: 3, color: '#e0e0e0' }}>
            You're buying <strong style={{ color: selected.color }}>{selected.credits.toLocaleString()}</strong> credits
            {selected.bonusCredits > 0 && <> (includes <strong style={{ color: selected.color }}>+{selected.bonusCredits.toLocaleString()} bonus</strong>)</>}
            .
          </Typography>

          {/* Stripe component */}
          <Box sx={{ mb: 3 }}>
            <Stripe
              credits={selected.credits}
              amount={Math.round(selected.dollars * 100)} // cents
              currency="usd"
              description={`${selected.credits} credits`}
              metadata={{ credits: selected.credits }}
              priceId={selected.priceId}
              onSuccess={handleSuccess}
            />
          </Box>

          <Typography variant="body2" sx={{ color: '#bdbdbd' }}>
            After payment you'll be redirected back. If you need invoices or support, contact support.
          </Typography>
        </Paper>
      )}

      {/* Payment Confirmation Modal */}
      <Dialog
        open={showModal}
        onClose={(event, reason) => {
          // Prevent closing on backdrop click or escape key
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            return;
          }
          handleCancelPayment();
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ backgroundColor: '#424242', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning sx={{ color: '#ff9800' }} />
          Payment Window Notice
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#424242', color: 'white', pt: 3 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              A new window will open to complete your payment securely through Stripe.
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
              Please do not close this page until your payment is complete.
            </Typography>
            {pendingPackage && (
              <Paper sx={{ p: 2, backgroundColor: '#353535', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Package Details:
                </Typography>
                <Typography variant="h6" sx={{ color: pendingPackage.color, fontWeight: 'bold' }}>
                  {pendingPackage.credits.toLocaleString()} Credits
                </Typography>
                <Typography variant="body1" sx={{ color: 'white' }}>
                  ${pendingPackage.dollars.toFixed(2)} USD
                </Typography>
                {pendingPackage.bonusCredits > 0 && (
                  <Chip
                    icon={<LocalOffer />}
                    label={`+${pendingPackage.bonusCredits.toLocaleString()} Bonus Credits`}
                    size="small"
                    sx={{ mt: 1, backgroundColor: pendingPackage.color, color: 'white' }}
                  />
                )}
              </Paper>
            )}
            <Alert severity="info" sx={{ backgroundColor: '#1976d2', color: 'white' }}>
              You will be redirected to Stripe's secure checkout. After payment you'll return here automatically.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#424242', p: 2 }}>
          <Button
            onClick={handleCancelPayment}
            variant="outlined"
            disabled={isRedirecting}
            sx={{ color: '#bdbdbd', borderColor: '#bdbdbd' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPayment}
            variant="contained"
            disabled={isRedirecting}
            startIcon={isRedirecting ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <OpenInNew />}
            sx={{ backgroundColor: '#4caf50', color: 'white', fontWeight: 'bold' }}
          >
            {isRedirecting ? 'Redirecting...' : 'Proceed to Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success / error message */}
      {message && (
        <Alert
          severity={message.startsWith('Failed') ? 'error' : 'success'}
          sx={{
            mt: 3,
            backgroundColor: message.startsWith('Failed') ? '#c62828' : '#2e7d32',
            color: 'white',
            '& .MuiAlert-icon': { color: 'white' }
          }}
        >
          {message}
        </Alert>
      )}
    </Container>
  );
}