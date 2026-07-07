import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  CheckCircle,
  Home,
  Receipt,
  CreditCard,
} from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

export default function PurchaseStripeSuccessful() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [session, setSession]   = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      setError('No session ID found');
      setLoading(false);
      return;
    }

    verifySession(sessionId);
  }, [searchParams]);

  const verifySession = async (sessionId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/stripe-purchase/verify-session?session_id=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to verify session');
      }

      const data = await response.json();

      if (data.success) {
        setSession(data.session);

        // Update credits in localStorage
        const userData = JSON.parse(localStorage.getItem('userdata') || '{}');
        if (userData && data.session?.credits) {
          userData.credits = (userData.credits || 0) + data.session.credits;
          localStorage.setItem('userdata', JSON.stringify(userData));
        }
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#4caf50', mb: 2 }} size={60} />
          <Typography variant="h6" sx={{ color: '#ccc' }}>Confirming your payment…</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper elevation={6} sx={{ p: 6, backgroundColor: '#1a1a1a', border: '3px solid #c62828', borderRadius: 4, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ color: '#c62828', fontWeight: 'bold', mb: 2 }}>Verification Failed</Typography>
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
          <Button variant="contained" onClick={() => navigate('/purchase-stripe')}
            sx={{ backgroundColor: '#ffd700', color: '#0a0a0a', fontWeight: 'bold' }}>
            Back to Buy Credits
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper
        elevation={6}
        sx={{
          p: 6,
          backgroundColor: '#1a1a1a',
          border: '3px solid #2e7d32',
          borderRadius: 4,
          textAlign: 'center'
        }}
      >
        {/* Success Icon */}
        <Box sx={{ mb: 3 }}>
          <CheckCircle
            sx={{
              fontSize: 100,
              color: '#2e7d32',
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.1)' }
              }
            }}
          />
        </Box>

        <Typography variant="h3" sx={{ color: '#2e7d32', fontWeight: 'bold', mb: 2 }}>
          Payment Successful!
        </Typography>

        <Typography variant="h6" sx={{ color: '#ffd700', mb: 2 }}>
          Thank You for Your Purchase! 🎉
        </Typography>

        {session && (
          <Paper sx={{ p: 2, mb: 3, backgroundColor: '#2a2a2a', borderRadius: 2 }}>
            <Typography variant="h5" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
              +{session.credits?.toLocaleString()} Credits Added
            </Typography>
            {session.dollars > 0 && (
              <Typography variant="body2" sx={{ color: '#bdbdbd', mt: 0.5 }}>
                ${session.dollars.toFixed(2)} charged · {session.label || ''}
              </Typography>
            )}
          </Paper>
        )}

        <Typography variant="body1" sx={{ color: '#ccc', mb: 4, lineHeight: 1.8 }}>
          Your credits have been added to your account. We appreciate your trust in our service!
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Home />}
            onClick={() => navigate('/dashboard')}
            sx={{ backgroundColor: '#ffd700', color: '#0a0a0a', fontWeight: 'bold', py: 1.5,
              '&:hover': { backgroundColor: '#e6c200' } }}
          >
            Go to Dashboard
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<Receipt />}
            onClick={() => navigate('/credit-purchase-history')}
            sx={{ borderColor: '#2e7d32', color: '#2e7d32', py: 1.5,
              '&:hover': { backgroundColor: '#2e7d3220', borderColor: '#2e7d32' } }}
          >
            View Purchase History
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<CreditCard />}
            onClick={() => navigate('/purchase-stripe')}
            sx={{ borderColor: '#ffd700', color: '#ffd700', py: 1.5,
              '&:hover': { backgroundColor: '#ffd70020', borderColor: '#ffd700' } }}
          >
            Buy More Credits
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
       