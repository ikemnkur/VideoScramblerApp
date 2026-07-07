import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import {
  CreditCard,
  Star,
  AttachMoney,
  Warning,
  Cancel,
  Settings,
  ArrowDownward,
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
    priceId: null,
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
    priceId: import.meta.env.VITE_BASIC_PRICE_ID || 'price_1SR08eEViYxfJNd2ihaRH9Fk',
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
    priceId: import.meta.env.VITE_STANDARD_PRICE_ID || 'price_1SR09uEViYxfJNd2jL3JklFl',
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
    priceId: import.meta.env.VITE_PREMIUM_PRICE_ID || 'price_1SR0A9EViYxfJNd258I14txA',
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


export default function Plans() {
  const { success, error } = useToast();

  const [userdata, setUserData] = useState({});
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [loading, setLoading] = useState(false);

  // Confirm upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);

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

  // ─── Subscribe: create Stripe checkout session and redirect ───────────────

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

  async function handleConfirmUpgrade() {
    if (!pendingPlan || !pendingPlan.priceId) return;
    setLoading(true);
    setShowUpgradeModal(false);
    try {
      const response = await api.post('/api/subscription/create-checkout', {
        userId: userdata.id,
        username: userdata.username,
        email: userdata.email,
        priceId: pendingPlan.priceId,
        planId: selectedPlan,
        planName: pendingPlan.title,
        successUrl: `${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/plans`,
      });
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      error('Failed to start checkout. Please try again.');
      setPendingPlan(null);
    } finally {
      setLoading(false);
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
        window.location.href = response.data.url;
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
    if (loading) return 'Redirecting to Stripe…';
    if (currentPlan === selectedPlan) return 'Current Plan';
    if (selectedPlan === 'free') return 'Downgrade to Free';
    if (PLAN_HIERARCHY[selectedPlan] < PLAN_HIERARCHY[currentPlan]) return `Downgrade to ${p.title}`;
    return `Subscribe to ${p.title}`;
  }

  function getPlanActionIcon() {
    if (loading) return <CircularProgress size={16} color="inherit" />;
    if (PLAN_HIERARCHY[selectedPlan] < PLAN_HIERARCHY[currentPlan]) return <ArrowDownward />;
    return <CreditCard />;
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
                    disabled={currentPlan === selectedPlan || loading}
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
        onClose={() => { setShowUpgradeModal(false); setPendingPlan(null); }}
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
          <Warning sx={{ color: '#ff9800' }} />
          Confirm Subscription
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#424242', color: 'white', pt: 3 }}>
          {pendingPlan && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                You'll be redirected to Stripe to complete your payment securely.
                You'll be brought back here automatically once it's done.
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
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#424242', p: 2 }}>
          <Button
            onClick={() => { setShowUpgradeModal(false); setPendingPlan(null); }}
            variant="outlined"
            sx={{ color: '#bdbdbd', borderColor: '#bdbdbd' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmUpgrade}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CreditCard />}
            sx={{ backgroundColor: '#4caf50', color: 'white', fontWeight: 'bold' }}
          >
            {loading ? 'Redirecting…' : 'Proceed to Payment'}
          </Button>
        </DialogActions>
      </Dialog>

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
