import React, { useState } from "react";
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
  Chip
} from '@mui/material';
import { 
  CreditCard, 
  LocalOffer, 
  TrendingUp,
  CheckCircle
} from '@mui/icons-material';
import Stripe from "../components/Stripe";

const PACKAGES = [
  { dollars: 2.5, label: "$2.50", color: '#4caf50' },
  { dollars: 5, label: "$5.00", color: '#2196f3' },
  { dollars: 10, label: "$10.00", color: '#9c27b0', popular: true },
  { dollars: 20, label: "$20.00", color: '#f57c00' },
];

// Incentive multipliers by package amount (bigger packages get larger bonus)
const MULTIPLIERS = {
  2.5: 1.00, // no bonus
  5: 1.05,   // 5% bonus
  10: 1.12,  // 12% bonus
  20: 1.30,  // 30% bonus
};

function computePackageInfo(dollars) {
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

  const packageInfos = PACKAGES.map(p => ({
    ...computePackageInfo(p.dollars),
    color: p.color,
    popular: p.popular
  }));

  function handleSelect(pkgInfo) {
    setMessage(null);
    setSelected(pkgInfo);
  }

  function handleSuccess(sessionOrResult) {
    // Called after successful payment (whatever your Stripe.jsx returns).
    setMessage("Payment successful — credits will appear in your account shortly.");
    setSelected(null);
    // TODO: call your backend to grant credits using sessionOrResult metadata
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
                  <Typography variant="caption" fontWeight="bold" sx={{paddingTop: '5px'}}>
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
      {selected && (
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
              amount={Math.round(selected.dollars * 100)} // cents
              currency="usd"
              description={`${selected.credits} credits`}
              metadata={{ credits: selected.credits }}
              onSuccess={handleSuccess}
            />
          </Box>

          <Typography variant="body2" sx={{ color: '#bdbdbd' }}>
            After payment you'll be redirected back. If you need invoices or support, contact support.
          </Typography>
        </Paper>
      )}

      {/* Success Message */}
      {message && (
        <Alert 
          severity="success" 
          sx={{ 
            mt: 3,
            backgroundColor: '#2e7d32',
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