import React, { useEffect, useState, useRef } from 'react';
import {
  Container,
  Stack,
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  CreditCard,
  Star,
  AttachMoney,
  Warning,
  OpenInNew,
  Cancel,
  Settings,
  CheckCircle,
  ArrowDownward,
  ArrowUpward,
} from '@mui/icons-material';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { fetchUserData } from '../utils/fetchUserData';

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAN_HIERARCHY = { free: 0, basic: 1, standard: 2, premium: 3 };

const PLANS = {
  free: {
    title: 'Free',
    priceLabel: 'Free',
    color: '#757575',
    features: [
      'Ads displayed',
      'Limited file sizes',
      'Limited video and photo scrambling modes',
      'Simple un/scrambler algorithms',
      'Annoying watermarks',
      'Longest wait times',
    ],
  },
  basic: {
    title: 'Basic',
    priceLabel: '$2.50',
    color: '#009cde',
    features: [
      'No ads',
      'Standard quality video',
      'No watermarks',
      'Normal unscrambling',
      'File size limits apply',
      'Audio scrambling/unscrambling',
      'Standard wait times',
    ],
  },
  standard: {
    title: 'Standard',
    priceLabel: '$5',
    color: '#93b2f0',
    features: [
      'Faster processing',
      'Longer videos',
      'Content leak prevention',
      'Advanced photo scrambling',
      'HD videos',
      'Larger file size limits',
    ],
  },
  premium: {
    title: 'Premium',
    priceLabel: '$10',
    color: '#5ad64e',
    features: [
      'No wait times',
      'Advanced video scrambling',
      'Content leak prevention & detection',
      'Full HD and 4K videos',
      'Largest file size limits (250 MB)',
      'Priority support',
    ],
  },
};

const STRIPE_CHECKOUT_URLS = {
  basic: import.meta.env.VITE_BASIC_PLAN || 'https://buy.stripe.com/test_5kQ3co2pZg021AVbjj0sU0b',
  standard: import.meta.env.VITE_STANDARD_PLAN || 'https://buy.stripe.com/test_aFa3cod4D29cgvP9bb0sU0a',
  premium: import.meta.env.VITE_PREMIUM_PLAN || 'https://buy.stripe.com/test_eVq5kw2pZ6ps7Zj8770sU09',
};

async function fetchUserIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch {
    return null;
  }
}


export default function Plans() {
  const { success, error } = useToast();

  const [userdata, setUserData] = useState({});
  const [selectedPlan, setSelectedPlan] = useState('premium');

  // Upgrade flow
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [startTimestamp, setStartTimestamp] = useState(null);
  const [isWaitingForReturn, setIsWaitingForReturn] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const paymentWindowRef = useRef(null);
  const checkIntervalRef = useRef(null);

  // Cancel / Downgrade flow
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);

  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('success');

  const currentPlan = userdata?.accountType || 'free';
  const p = PLANS[selectedPlan];

  // ─── Load user data on mount ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const fresh = await fetchUserData();
      if (fresh) setUserData(fresh);
    };
    load();
  }, []);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, []);

  // ─── Upgrade flow ─────────────────────────────────────────────────────────

  function handleSubscribeClick() {
    if (currentPlan === selectedPlan) {
      error('You are already on this plan.');
      return;
    }
    setPendingPlan(PLANS[selectedPlan]);
    setMessage(null);
    if (PLAN_HIERARCHY[selectedPlan] < PLAN_HIERARCHY[currentPlan]) {
      setShowDowngradeModal(true);
    } else {
      setShowUpgradeModal(true);
    }
  }

  function handleCancelUpgrade() {
    setShowUpgradeModal(false);
    setPendingPlan(null);
  }

  function handleConfirmUpgrade() {
    if (!pendingPlan) return;
    const stripeUrl = STRIPE_CHECKOUT_URLS[selectedPlan];
    if (!stripeUrl) {
      error('No payment URL configured for this plan.');
      setShowUpgradeModal(false);
      return;
    }
    const timestamp = Date.now();
    setStartTimestamp(timestamp);
    paymentWindowRef.current = window.open(
      `${stripeUrl}?client_reference_id=${userdata.id || ''}`,
      '_blank'
    );
    setIsWaitingForReturn(true);
    setShowUpgradeModal(false);
  }

  function handleReturnFromPayment() {
    const endTimestamp = Date.now();
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    setIsWaitingForReturn(false);
    verifyPayment(startTimestamp, endTimestamp);
  }

  async function verifyPayment(startTime, endTime) {
    if (!pendingPlan) return;
    setIsVerifying(true);
    try {
      const planPrice =
        pendingPlan.priceLabel === 'Free'
          ? 0
          : parseFloat(pendingPlan.priceLabel.replace('$', ''));

      const paymentData = {
        timeRange: { start: startTime, end: endTime },
        subscriptionData: {
          amount: Math.ceil(planPrice * 100),
          dollars: planPrice,
          plan: pendingPlan.title,
          planType: selectedPlan,
        },
        user: {
          id: userdata.id || '',
          email: userdata.email || '',
          username: userdata.username || '',
          phone: userdata.phoneNumber || '',
          name: `${userdata.firstName || ''} ${userdata.lastName || ''}`.trim(),
          ip: (await fetchUserIP()) || '',
          userAgent: navigator.userAgent || '',
        },
      };

      const response = await api.post('/api/verify-stripe-subscription', paymentData);
      if (response.data && response.data.success !== false) {
        showMessage(`${pendingPlan.title} plan activated! Welcome aboard.`, 'success');
        success(`${pendingPlan.title} plan activated!`);
        const updated = await fetchUserData();
        if (updated) setUserData(updated);
      } else {
        showMessage(
          "Subscription verification pending. If your plan doesn't activate within 5 minutes, contact support.",
          'warning'
        );
      }
    } catch (err) {
      console.error('Subscription verification error:', err);
      showMessage(
        `Unable to verify automatically. Contact support with your transaction time: ${new Date(startTime).toISOString()}`,
        'error'
      );
    } finally {
      setIsVerifying(false);
      setPendingPlan(null);
      setStartTimestamp(null);
      paymentWindowRef.current = null;
    }
  }

  // ─── Cancel flow ──────────────────────────────────────────────────────────

  async function handleConfirmCancel() {
    setIsCanceling(true);
    try {
      const response = await api.post('/api/subscription/cancel', { userId: userdata.id });
      if (response.data?.success) {
        showMessage(
          'Your subscription is set to cancel at the end of the billing period. Your account will revert to the Free plan.',
          'success'
        );
        success('Subscription cancellation scheduled.');
        const updated = await fetchUserData();
        if (updated) setUserData(updated);
      } else {
        error(response.data?.message || 'Failed to cancel subscription.');
      }
    } catch (err) {
      console.error('Cancel subscription error:', err);
      error('Failed to cancel subscription. Please try again.');
    } finally {
      setIsCanceling(false);
      setShowCancelModal(false);
    }
  }

  // ─── Downgrade flow ───────────────────────────────────────────────────────

  async function handleConfirmDowngrade() {
    setIsDowngrading(true);
    try {
      const response = await api.post('/api/subscription/change-plan', {
        userId: userdata.id,
        newPlanType: selectedPlan,
      });
      if (response.data?.success) {
        showMessage(
          `Plan downgraded to ${PLANS[selectedPlan].title}. Changes take effect immediately.`,
          'success'
        );
        success(`Downgraded to ${PLANS[selectedPlan].title} plan.`);
        const updated = await fetchUserData();
        if (updated) setUserData(updated);
      } else {
        error(response.data?.message || 'Failed to downgrade plan.');
      }
    } catch (err) {
      console.error('Downgrade error:', err);
      error('Failed to downgrade plan. Please try again.');
    } finally {
      setIsDowngrading(false);
      setShowDowngradeModal(false);
      setPendingPlan(null);
    }
  }

  // ─── Stripe Customer Portal ───────────────────────────────────────────────

  async function handleManageSubscription() {
    try {
      const response = await api.post('/api/subscription/portal', {
        userId: userdata.id,
        returnUrl: window.location.href,
      });
      if (response.data?.url) {
        window.open(response.data.url, '_blank');
      } else {
        error('Unable to open subscription portal.');
      }
    } catch (err) {
      console.error('Portal error:', err);
      error('Unable to open subscription portal. Please try again.');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function showMessage(text, type = 'success') {
    setMessage(text);
    setMessageType(type);
  }

  function getPlanActionLabel() {
    if (currentPlan === selectedPlan) return `Already on ${p.title}`;
    if (selectedPlan === 'free') return 'Cancel Subscription (Go Free)';
    if (PLAN_HIERARCHY[selectedPlan] < PLAN_HIERARCHY[currentPlan])
      return `Downgrade to ${p.title} — ${p.priceLabel}/mo`;
    return `Subscribe — ${p.title} ${p.priceLabel}/mo`;
  }

  function getPlanActionIcon() {
    if (PLAN_HIERARCHY[selectedPlan] < PLAN_HIERARCHY[currentPlan]) return <ArrowDownward />;
    if (PLAN_HIERARCHY[selectedPlan] > PLAN_HIERARCHY[currentPlan]) return <ArrowUpward />;
    return <CheckCircle />;
  }


  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4" color="secondary.main">
          Account Membership
        </Typography>

        {/* ── Current Plan Banner ── */}
        <Card variant="outlined">
          <CardContent
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
              py: 2,
            }}
          >
            <Box>
              <Typography variant="overline" sx={{ color: '#9e9e9e' }}>
                Current Plan
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, color: PLANS[currentPlan]?.color }}
                >
                  {PLANS[currentPlan]?.title || currentPlan.toUpperCase()}
                </Typography>
                {currentPlan !== 'free' && (
                  <Chip
                    label="Active"
                    size="small"
                    sx={{ backgroundColor: '#2e7d32', color: 'white', fontSize: 11 }}
                  />
                )}
              </Box>
              {currentPlan !== 'free' && PLANS[currentPlan]?.priceLabel && (
                <Typography variant="body2" sx={{ color: '#bdbdbd', mt: 0.5 }}>
                  {PLANS[currentPlan].priceLabel}/month — renews automatically
                </Typography>
              )}
            </Box>

            {currentPlan !== 'free' && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Settings />}
                  onClick={handleManageSubscription}
                  sx={{ borderColor: '#4f46e5', color: '#7c6ff7' }}
                >
                  Manage Billing
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<Cancel />}
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel Plan
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* ── Plan Selection ── */}
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="h5"
              sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Star color="primary" />
              Choose a Plan
            </Typography>

            <Grid container spacing={2}>
              {/* Plan Buttons */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={2}
                  sx={{
                    p: 2,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    backgroundColor: '#424242',
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'white' }}
                  >
                    <CreditCard color="primary" />
                    Subscription Plans
                  </Typography>

                  <Stack spacing={1}>
                    {['premium', 'standard', 'basic', 'free'].map((planKey) => {
                      const plan = PLANS[planKey];
                      const isCurrent = currentPlan === planKey;
                      const isSelected = selectedPlan === planKey;

                      return (
                        <Button
                          key={planKey}
                          onClick={() => setSelectedPlan(planKey)}
                          variant={isSelected ? 'contained' : 'outlined'}
                          sx={{
                            backgroundColor: isSelected ? plan.color : 'transparent',
                            borderColor: plan.color,
                            color: isSelected ? 'white' : plan.color,
                            fontWeight: 'bold',
                            justifyContent: 'flex-start',
                            '&:hover': {
                              backgroundColor: plan.color,
                              color: 'white',
                              opacity: 0.9,
                            },
                          }}
                        >
                          {plan.title}
                          {plan.priceLabel !== 'Free' ? ` — ${plan.priceLabel}/mo` : ' — Free'}
                          {isCurrent && (
                            <Chip
                              label="Current"
                              size="small"
                              sx={{
                                ml: 1,
                                height: 18,
                                fontSize: 10,
                                backgroundColor: 'rgba(255,255,255,0.25)',
                                color: 'white',
                              }}
                            />
                          )}
                        </Button>
                      );
                    })}

                    <Typography variant="caption" sx={{ color: '#9e9e9e', mt: 0.5 }}>
                      Click a plan to preview its features before subscribing.
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>

              {/* Plan Details + Action */}
              <Grid item xs={12} md={6}>
                <Stack spacing={2}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      border: '2px solid',
                      borderColor: p.color,
                      backgroundColor: '#424242',
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 1, color: 'white' }}>
                      {p.title} Plan
                      {p.priceLabel !== 'Free' && (
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{ ml: 1, color: '#bdbdbd' }}
                        >
                          {p.priceLabel}/month
                        </Typography>
                      )}
                    </Typography>
                    <Stack spacing={0.5}>
                      {p.features.map((f, i) => (
                        <Typography key={i} variant="body2" sx={{ color: '#e0e0e0' }}>
                          • {f}
                        </Typography>
                      ))}
                    </Stack>
                  </Paper>

                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={
                      selectedPlan === 'free' && currentPlan !== 'free'
                        ? () => setShowCancelModal(true)
                        : handleSubscribeClick
                    }
                    disabled={currentPlan === selectedPlan}
                    startIcon={getPlanActionIcon()}
                    sx={{
                      backgroundColor:
                        currentPlan === selectedPlan
                          ? '#555'
                          : selectedPlan === 'free'
                          ? '#c62828'
                          : p.color,
                      color: 'white',
                      fontWeight: 'bold',
                      py: 1.5,
                      '&:hover': { opacity: 0.9 },
                      '&.Mui-disabled': { color: '#aaa' },
                    }}
                  >
                    {getPlanActionLabel()}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ── Billing Info ── */}
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="h6"
              sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AttachMoney color="secondary" />
              Billing & Subscription Info
            </Typography>
            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
              Subscriptions renew automatically each month. Use{' '}
              <strong>Manage Billing</strong> to update your payment method, view
              invoices, or make other changes directly in the Stripe portal. Accounts
              inactive for 60+ days will not auto-renew and are deleted after 90 days.
            </Typography>
          </CardContent>
        </Card>

        {/* ── Status message ── */}
        {message && (
          <Alert
            severity={messageType}
            onClose={() => setMessage(null)}
            sx={
              messageType === 'success'
                ? {
                    backgroundColor: '#2e7d32',
                    color: 'white',
                    '& .MuiAlert-icon': { color: 'white' },
                  }
                : {}
            }
          >
            {message}
          </Alert>
        )}
      </Stack>

      {/* ═══════════════════════════════════════════════════════
          UPGRADE CONFIRMATION MODAL
      ═══════════════════════════════════════════════════════ */}
      <Dialog
        open={showUpgradeModal}
        onClose={handleCancelUpgrade}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle
          sx={{
            backgroundColor: '#424242',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Warning sx={{ color: '#ff9800' }} />
          Confirm Subscription
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#424242', color: 'white', pt: 3 }}>
          {pendingPlan && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                A new tab will open to complete payment securely through Stripe.
                Please do not close this page until your payment is complete.
              </Typography>
              <Paper sx={{ p: 2, backgroundColor: '#353535', mb: 2 }}>
                <Typography
                  variant="h6"
                  sx={{ color: 'primary.main', fontWeight: 'bold' }}
                >
                  {pendingPlan.title} Plan
                </Typography>
                <Typography variant="body1" sx={{ color: 'white', mb: 1 }}>
                  {pendingPlan.priceLabel === 'Free'
                    ? 'Free'
                    : `${pendingPlan.priceLabel}/month`}
                </Typography>
                {pendingPlan.features.slice(0, 3).map((f, i) => (
                  <Typography key={i} variant="body2" sx={{ color: '#e0e0e0' }}>
                    • {f}
                  </Typography>
                ))}
                {pendingPlan.features.length > 3 && (
                  <Typography variant="body2" sx={{ color: '#bdbdbd' }}>
                    + {pendingPlan.features.length - 3} more features
                  </Typography>
                )}
              </Paper>
              <Alert severity="info">
                After completing payment, return here and click "I've Completed
                Payment" to activate your plan.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#424242', p: 2 }}>
          <Button
            onClick={handleCancelUpgrade}
            variant="outlined"
            sx={{ color: '#bdbdbd', borderColor: '#bdbdbd' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmUpgrade}
            variant="contained"
            startIcon={<OpenInNew />}
            sx={{ backgroundColor: '#4caf50', color: 'white', fontWeight: 'bold' }}
          >
            Proceed to Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          WAITING FOR RETURN MODAL
      ═══════════════════════════════════════════════════════ */}
      <Dialog
        open={isWaitingForReturn && !isVerifying}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: '#424242',
            color: 'white',
            textAlign: 'center',
            pb: 1,
          }}
        >
          <OpenInNew sx={{ fontSize: 40, color: '#4caf50' }} />
        </DialogTitle>
        <DialogContent
          sx={{ backgroundColor: '#424242', color: 'white', pt: 2, textAlign: 'center' }}
        >
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
            Complete Your Payment
          </Typography>
          <Typography variant="body1" sx={{ color: '#e0e0e0', mb: 2 }}>
            A payment tab has been opened. After completing your subscription, click
            the button below to verify and activate your plan.
          </Typography>
          <Alert severity="info" sx={{ mb: 1, textAlign: 'left' }}>
            Haven't completed payment yet? The payment window should still be open.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#424242', p: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleReturnFromPayment}
            sx={{
              backgroundColor: '#4caf50',
              color: 'white',
              fontWeight: 'bold',
              px: 4,
              py: 1.5,
            }}
          >
            I've Completed Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          VERIFICATION PROGRESS SNACKBAR
      ═══════════════════════════════════════════════════════ */}
      {isVerifying && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            p: 2,
            backgroundColor: '#424242',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 1400,
            borderRadius: 2,
          }}
        >
          <CircularProgress size={24} sx={{ color: '#4caf50' }} />
          <Typography variant="body2">Verifying subscription…</Typography>
        </Paper>
      )}

      {/* ═══════════════════════════════════════════════════════
          CANCEL SUBSCRIPTION MODAL
      ═══════════════════════════════════════════════════════ */}
      <Dialog
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            backgroundColor: '#424242',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Cancel sx={{ color: '#f44336' }} />
          Cancel Subscription
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#424242', color: 'white', pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to cancel your{' '}
            <strong>{PLANS[currentPlan]?.title}</strong> subscription?
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your subscription will stay active until the end of the current billing
            period. After that, your account reverts to the Free plan.
          </Alert>
          <Typography variant="body2" sx={{ color: '#bdbdbd' }}>
            You can re-subscribe at any time — all your data will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#424242', p: 2 }}>
          <Button
            onClick={() => setShowCancelModal(false)}
            variant="outlined"
            sx={{ color: '#bdbdbd', borderColor: '#bdbdbd' }}
          >
            Keep My Plan
          </Button>
          <Button
            onClick={handleConfirmCancel}
            variant="contained"
            color="error"
            disabled={isCanceling}
            startIcon={
              isCanceling ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Cancel />
              )
            }
          >
            {isCanceling ? 'Cancelling…' : 'Cancel Subscription'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          DOWNGRADE MODAL
      ═══════════════════════════════════════════════════════ */}
      <Dialog
        open={showDowngradeModal}
        onClose={() => {
          setShowDowngradeModal(false);
          setPendingPlan(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            backgroundColor: '#424242',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <ArrowDownward sx={{ color: '#ff9800' }} />
          Downgrade Plan
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#424242', color: 'white', pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            You are downgrading from{' '}
            <strong style={{ color: PLANS[currentPlan]?.color }}>
              {PLANS[currentPlan]?.title}
            </strong>{' '}
            to{' '}
            <strong style={{ color: PLANS[selectedPlan]?.color }}>
              {PLANS[selectedPlan]?.title}
            </strong>
            .
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            The downgrade takes effect immediately. You will lose access to features
            exclusive to your current plan.
          </Alert>
          <Paper sx={{ p: 2, backgroundColor: '#353535' }}>
            <Typography variant="subtitle2" sx={{ color: '#bdbdbd', mb: 1 }}>
              New plan features:
            </Typography>
            {PLANS[selectedPlan]?.features.map((f, i) => (
              <Typography key={i} variant="body2" sx={{ color: '#e0e0e0' }}>
                • {f}
              </Typography>
            ))}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#424242', p: 2 }}>
          <Button
            onClick={() => {
              setShowDowngradeModal(false);
              setPendingPlan(null);
            }}
            variant="outlined"
            sx={{ color: '#bdbdbd', borderColor: '#bdbdbd' }}
          >
            Keep Current Plan
          </Button>
          <Button
            onClick={handleConfirmDowngrade}
            variant="contained"
            disabled={isDowngrading}
            startIcon={
              isDowngrading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <ArrowDownward />
              )
            }
            sx={{ backgroundColor: '#ff9800', color: 'white', fontWeight: 'bold' }}
          >
            {isDowngrading
              ? 'Downgrading…'
              : `Downgrade to ${PLANS[selectedPlan]?.title}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
