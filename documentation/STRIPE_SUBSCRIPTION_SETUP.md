# Stripe Subscription Setup Guide

Complete guide to setting up recurring subscription payments with Stripe in your VideoScramblerApp.

## Prerequisites

- Stripe account (sign up at https://stripe.com)
- MySQL database running
- Node.js backend server
- React frontend

## Step 1: Stripe Account Setup

### 1.1 Create Stripe Account
1. Go to https://stripe.com and create an account
2. Complete account verification
3. Access your Dashboard

### 1.2 Get API Keys
1. Go to **Developers** → **API keys**
2. Copy your keys:
   - **Publishable key** (starts with `pk_test_`) - for frontend
   - **Secret key** (starts with `sk_test_`) - for backend
   
⚠️ **Important**: Use test keys for development, live keys for production

### 1.3 Create Subscription Products

1. Go to **Products** → **Add Product**

2. **Basic Plan:**
   - Name: `Basic Subscription`
   - Description: `1,000 credits per month with basic features`
   - Pricing: `$9.99 / month`
   - Click **Add pricing** → Select **Recurring**
   - Copy the **Price ID** (starts with `price_`)

3. **Pro Plan:**
   - Name: `Pro Subscription`
   - Description: `5,000 credits per month with all features`
   - Pricing: `$24.99 / month`
   - Copy the **Price ID**

4. **Enterprise Plan:**
   - Name: `Enterprise Subscription`
   - Description: `Unlimited credits with premium support`
   - Pricing: `$99.99 / month`
   - Copy the **Price ID**

### 1.4 Setup Webhook (Important!)

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://yourdomain.com/api/subscription/webhook`
   - For local testing: Use **Stripe CLI** or **ngrok**
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

## Step 2: Database Setup

### 2.1 Run Subscription Schema

```bash
mysql -u root -p KeyChingDB < database/schema/subscriptions.sql
```

### 2.2 Verify Tables Created

```sql
mysql -u root -p
USE KeyChingDB;

SHOW TABLES;
-- Should see: subscriptions, subscription_history

DESCRIBE subscriptions;
```

## Step 3: Environment Configuration

### 3.1 Update .env File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Stripe keys:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Stripe Price IDs
STRIPE_PRICE_ID_BASIC=price_YOUR_BASIC_PRICE_ID
STRIPE_PRICE_ID_PRO=price_YOUR_PRO_PRICE_ID
STRIPE_PRICE_ID_ENTERPRISE=price_YOUR_ENTERPRISE_PRICE_ID
```

### 3.2 Update Frontend Price IDs

Edit `src/pages/SubscriptionPlans.jsx`:

```javascript
const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 9.99,
    stripePriceId: 'price_YOUR_BASIC_PRICE_ID_HERE', // ← Update this
    // ...
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 24.99,
    stripePriceId: 'price_YOUR_PRO_PRICE_ID_HERE', // ← Update this
    // ...
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99.99,
    stripePriceId: 'price_YOUR_ENTERPRISE_PRICE_ID_HERE', // ← Update this
    // ...
  }
];
```

## Step 4: Install Dependencies

### 4.1 Backend Dependencies

```bash
npm install stripe
```

### 4.2 Frontend Dependencies

Already installed from previous commands:
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## Step 5: Add Routes to Your App

### 5.1 Update App Router

Edit your main routing file (e.g., `App.jsx`):

```jsx
import SubscriptionPlans from './pages/SubscriptionPlans';
import SubscriptionSuccess from './pages/SubscriptionSuccess';

// Add these routes
<Route path="/subscription/plans" element={<SubscriptionPlans />} />
<Route path="/subscription/success" element={<SubscriptionSuccess />} />
```

### 5.2 Add Navigation Links

Add subscription links to your navigation menu:

```jsx
<Button component={Link} to="/subscription/plans">
  Upgrade
</Button>
```

## Step 6: Testing

### 6.1 Start Servers

```bash
# Terminal 1: Backend
node old-server.cjs

# Terminal 2: Frontend
npm run dev
```

### 6.2 Test Subscription Flow

1. Open http://localhost:5173/subscription/plans
2. Click on a subscription plan
3. You'll be redirected to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
5. Complete checkout
6. You'll be redirected to success page

### 6.3 Verify in Database

```sql
SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 5;
```

Should see your new subscription record.

### 6.4 Check Stripe Dashboard

1. Go to **Customers** - should see new customer
2. Go to **Subscriptions** - should see active subscription
3. Go to **Payments** - should see successful payment

## Step 7: Webhook Testing (Local Development)

### 7.1 Install Stripe CLI

```bash
# Mac
brew install stripe/stripe-cli/stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases
```

### 7.2 Login to Stripe CLI

```bash
stripe login
```

### 7.3 Forward Webhooks to Local Server

```bash
stripe listen --forward-to localhost:3001/api/subscription/webhook
```

This will give you a webhook signing secret. Add it to your `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 7.4 Test Webhook Events

In another terminal:

```bash
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

Check your server console for webhook events.

## Step 8: Production Deployment

### 8.1 Switch to Live Keys

1. In Stripe Dashboard, toggle to **Live mode**
2. Get your live API keys
3. Update production `.env`:

```env
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
VITE_STRIPE_PUBLIC_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY
```

### 8.2 Update Webhook URL

1. Go to **Webhooks** in live mode
2. Add endpoint: `https://yourdomain.com/api/subscription/webhook`
3. Copy webhook secret and update `.env`

### 8.3 Update Success/Cancel URLs

Make sure URLs in `SubscriptionPlans.jsx` point to your production domain:

```javascript
successUrl: `https://yourdomain.com/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
cancelUrl: `https://yourdomain.com/subscription/plans`
```

## Step 9: Additional Features

### 9.1 Display Subscription Status

Show user's current subscription in Account page:

```jsx
import { useEffect, useState } from 'react';

function AccountPage() {
  const [subscription, setSubscription] = useState(null);
  
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userdata'));
    
    fetch(`/api/subscription/current/${userData.id}`)
      .then(res => res.json())
      .then(data => setSubscription(data.subscription));
  }, []);
  
  return (
    <div>
      {subscription && (
        <Card>
          <CardContent>
            <Typography variant="h6">Current Plan: {subscription.plan_name}</Typography>
            <Typography>Status: {subscription.status}</Typography>
            <Typography>
              Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
            </Typography>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 9.2 Protect Premium Features

Check subscription before allowing access:

```jsx
async function checkPremiumAccess(userId) {
  const response = await fetch(`/api/subscription/current/${userId}`);
  const data = await response.json();
  
  if (data.subscription && data.subscription.status === 'active') {
    return true; // Has active subscription
  }
  return false; // No active subscription
}
```

### 9.3 Add Subscription Gate

```jsx
function PremiumFeature() {
  const [hasAccess, setHasAccess] = useState(false);
  
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userdata'));
    checkPremiumAccess(userData.id).then(setHasAccess);
  }, []);
  
  if (!hasAccess) {
    return (
      <Alert severity="warning">
        This feature requires a premium subscription.
        <Button component={Link} to="/subscription/plans">
          Upgrade Now
        </Button>
      </Alert>
    );
  }
  
  return <div>Premium feature content here</div>;
}
```

## Troubleshooting

### Issue: "No such price"
**Solution:** Make sure Price IDs in your code match those in Stripe Dashboard

### Issue: "Webhook signature verification failed"
**Solution:** 
- Check `STRIPE_WEBHOOK_SECRET` in `.env`
- Use Stripe CLI for local testing
- Make sure endpoint URL in Stripe matches your server

### Issue: "Session not found"
**Solution:** Make sure you're passing the session_id correctly in the URL

### Issue: Subscription not showing in database
**Solution:**
- Check backend console for errors
- Verify database connection
- Make sure webhook is receiving events

### Issue: "Customer already has active subscription"
**Solution:** User can only have one active subscription. Cancel existing one first.

## Testing Credit Cards

Use Stripe test cards for development:

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Requires Authentication:** `4000 0025 0000 3155`
- **Insufficient Funds:** `4000 0000 0000 9995`

All with any future expiry, any CVC, any ZIP.

## Security Best Practices

1. ✅ Never expose secret keys in frontend code
2. ✅ Always verify webhook signatures
3. ✅ Use HTTPS in production
4. ✅ Store sensitive data encrypted
5. ✅ Implement rate limiting on API endpoints
6. ✅ Validate all user input
7. ✅ Log all subscription events
8. ✅ Monitor for suspicious activity

## Monitoring

### Track Key Metrics

```sql
-- Active subscriptions by plan
SELECT plan_id, COUNT(*) FROM subscriptions WHERE status = 'active' GROUP BY plan_id;

-- Monthly recurring revenue
SELECT 
  plan_id,
  plan_name,
  COUNT(*) as subscribers,
  CASE plan_id
    WHEN 'basic' THEN COUNT(*) * 9.99
    WHEN 'pro' THEN COUNT(*) * 24.99
    WHEN 'enterprise' THEN COUNT(*) * 99.99
  END as monthly_revenue
FROM subscriptions
WHERE status = 'active'
GROUP BY plan_id, plan_name;

-- Churn rate
SELECT 
  COUNT(*) as canceled_this_month
FROM subscription_history
WHERE event_type = 'canceled'
AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH);
```

## Support

- **Stripe Documentation:** https://stripe.com/docs
- **Stripe Support:** https://support.stripe.com
- **Stripe Discord:** https://discord.gg/stripe

## Next Steps

1. ✅ Test with Stripe test cards
2. ✅ Verify webhooks are working
3. ✅ Add subscription status to user dashboard
4. ✅ Implement premium feature gates
5. ✅ Set up email notifications
6. ✅ Add trial periods (optional)
7. ✅ Implement usage-based billing (optional)
8. ✅ Add promo codes/coupons (optional)

---

**Your subscription system is ready!** 🎉

Users can now:
- ✅ View subscription plans
- ✅ Subscribe with credit card
- ✅ Manage subscriptions
- ✅ Cancel subscriptions
- ✅ Access premium features
