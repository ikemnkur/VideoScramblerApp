# Copilot Instructions - VideoScramblerApp

## Project Overview

**VideoScramblerApp** is a React-based content protection platform that scrambles/unscrambles photos, videos, and audio files with integrated leak prevention through device fingerprinting. It operates as a dual-sided marketplace where sellers protect and monetize content, and buyers purchase unlock keys.

**Architecture:** 3-tier system:
- **Frontend:** React 18 + Vite + Material-UI (port 5173)
- **Node Backend:** Express + MySQL (port 3001) - handles auth, credits, marketplace
- **Python Backend:** Flask (port 5000) - advanced scrambling algorithms (Pro features)

## Critical Development Commands

```bash
# Start all services (requires 3 terminals)
npm run dev          # Terminal 1: Frontend (Vite)
node server.cjs      # Terminal 2: Node backend
python app.py        # Terminal 3: Flask scrambling service

# Alternative backend options
npm run server       # Runs server.cjs
npm run server-json  # JSON server (legacy)

# Database setup
mysql -u root -p -e "CREATE DATABASE KeyChingDB;"
mysql -u root -p KeyChingDB < database/schema/device_fingerprints.sql
npm run setup-mysql  # If setup script exists
```

## Architecture Patterns

### Device Fingerprinting System (Core Security Feature)

**Purpose:** Track which device unscrambled content to identify leak sources

**Data Flow:**
1. `DeviceFingerprint.js` (utility) → collects browser/device/network data
2. `FingerprintContext.jsx` (React Context) → provides fingerprint throughout app
3. `Auth.jsx` → submits fingerprint after login via `submitFingerprint(userId)`
4. `server.cjs` → saves to `device_fingerprints` table with hash

**Key Methods:**
- `DeviceFingerprint.generate()` - collects: canvas, WebGL, audio, screen, hardware
- `submitFingerprint(userId)` - called after successful auth
- `getEmbeddableFingerprint()` - encode for hiding in unscrambled content

**Integration Points:**
- Login/Register: Auto-submit fingerprint
- Unscramble: Increment `unscramble_count`, update `last_unscramble`
- Leak Detection: Mark device as blocked via `/api/fingerprint/leaked/:hash`

### Scrambling Algorithm Architecture

**Two-Tier System:**
- **Client-side (Basic):** Browser Canvas API manipulation (`ScramblerPhotos.jsx`)
- **Server-side (Pro):** Advanced Python algorithms via Flask (`app.py`)

**Python Scrambler (`app.py`) Routes:**
- `/scramble-photo` - POST with base64 image + params (seed, algorithm, mode)
- `/unscramble-photo` - POST with scrambled image + key
- `/extract-photo-code` - Extract embedded fingerprint metadata

**Audio Scrambling (`audioScrambler.js`):**
- **Segment Shuffling:** Split audio into time segments, rearrange with seed
- **Noise Application:** Reversible pseudorandom noise using LCG algorithm
- Params: `shuffleSeed`, `segmentSize`, `padding`, `noiseStrength`

**Key Generation:** All keys use seeded algorithms for reproducibility

### Credits & Marketplace System

**Credits = Virtual Currency:**
- Users buy credits (crypto/CashApp/Stripe) → stored in `userData.credits`
- Actions cost credits: scrambling (Pro), unscrambling, key purchases

**Transaction Flow:**
1. User unlocks key → `/api/unlock/:keyId` POST with `username`
2. Backend checks `createdKeys.available > 0` and `user.credits >= key.price`
3. Deduct buyer credits, add to seller credits, create `unlocks` record
4. Return `keyValue` to buyer

**Credit Spending:** Generic `/api/spend-credits` endpoint
```javascript
// Example: Spend credits for Pro scrambling
await api.post('/api/spend-credits', {
  username: 'buyer123',
  action: {
    cost: 50,
    type: 'pro_scramble',
    description: 'Advanced photo scrambling'
  }
});
```

## Database Schema Essentials

**Key Tables:**
- `userData` - users (VARCHAR(10) id, credits, accountType: buyer/seller)
- `createdKeys` - marketplace listings (keyValue as JSON array, quantity/available/sold)
- `unlocks` - purchase records (buyer + seller link, transaction history)
- `device_fingerprints` - fingerprint tracking (hash, device info, unscramble_count)
- `buyCredits` / `redeemCredits` - credit transactions
- `notifications` - user notifications (category: buyer/seller)

**Foreign Keys:** Most tables reference `userData.username` or `userData.id`

## API Conventions

### Node Backend (`server.cjs`)

**Authentication:**
- POST `/api/auth/login` - returns `{ success, user, token }`
- POST `/api/auth/register` - auto-login after registration
- POST `/api/auth/logout` - updates `loginStatus = false`

**Key Patterns:**
- All responses include `success: boolean` field
- Passwords hashed with bcrypt (12 rounds)
- User data excludes `passwordHash` in responses
- Dates: MySQL DATETIME format `YYYY-MM-DD HH:mm:ss`

**File Uploads (Busboy + GCS):**
- Profile pictures → Google Cloud Storage bucket
- Transaction screenshots → `/api/upload/transaction-screenshot/:username/:txHash`
- Images made public automatically, URLs returned

**Fingerprint Endpoints:**
- POST `/api/fingerprint/save` - save/update fingerprint
- GET `/api/fingerprint/user/:userId` - list user's devices
- POST `/api/fingerprint/unscramble/:hash` - track unscramble event
- POST `/api/fingerprint/leaked/:hash` - block compromised device

### Python Backend (`app.py`)

**Content Format:** Expects JSON with base64-encoded images
```python
{
  "input": "data:image/png;base64,...",
  "seed": 123456,
  "algorithm": "pixel_shuffle",  # or "block_scramble", "frequency", etc.
  "mode": "pro"
}
```

**Scrambling Algorithms:**
- `pixel_shuffle` - Fisher-Yates shuffle of pixels
- `block_scramble` - Divide into blocks, shuffle blocks
- `frequency` - FFT-based frequency domain scrambling
- `hybrid` - Combines multiple techniques

## Environment Variables (`.env`)

**Required:**
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - MySQL connection
- `VITE_API_SERVER_URL` - Frontend → Node backend URL (http://localhost:3001)
- `PORT` - Node server port (default: 3001)

**Optional but Important:**
- `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLIC_KEY` - payment processing
- `GCP_PROJECT_ID`, `GCS_BUCKET` - Google Cloud Storage for uploads
- `ETHERSCAN_API_KEY` - crypto transaction verification
- Blockchain explorer URLs for BTC/LTC/ETH/SOL

## Testing & Development

**PWA Configuration:** `vite.config.js` includes PWA plugin for offline capability

**CORS:** Server allows multiple origins (localhost:5173, 5174, production domains)

**Error Handling:**
- Frontend: `ErrorBoundary.jsx` wraps app
- Backend: Try-catch with detailed console.error logs
- Fingerprint errors: Fail gracefully, don't block user flow

## Common Workflows

**Adding New Scrambling Feature:**
1. Add algorithm to `app.py` (Python)
2. Create React component in `src/pages/` (e.g., `AudioScrambler.jsx`)
3. Add route in `App.jsx`
4. Integrate credit spending via `/api/spend-credits`
5. Update fingerprint tracking if unscrambling involved

**Adding API Endpoint:**
1. Define route in `server.cjs` with `server.post/get/put/delete`
2. Use `pool.execute()` for MySQL queries (async/await)
3. Return `{ success: boolean, ...data }` format
4. Add client method to `src/api/client.js` or `src/api/api.js`

**Crypto Payment Integration:**
- Transaction verification via blockchain APIs (Etherscan, Blockstream)
- Cron job (`node-cron`) fetches transactions every 30 min
- Stores in `CryptoTransactions_{BTC|ETH|LTC|SOL}` tables
- Lookup via `/api/lookup-transaction` with `transactionHash`

## Documentation Files

- `FINGERPRINT_ARCHITECTURE.md` - Complete fingerprint system diagrams
- `AUDIO_SCRAMBLER_README.md` - Audio scrambling technical details
- `SHUFFLE_ALGORITHM_DETAILED.md` - Segment shuffle math/examples
- `LEAK_DETECTION_SYSTEM_GUIDE.md` - Implementation guide for leak detection
- `QUICKSTART.md` - Fast setup instructions
- `STRIPE_SUBSCRIPTION_SETUP.md` - Payment integration

## Key Files

- `server.cjs` (4450 lines) - Main backend, all API endpoints
- `app.py` (719 lines) - Flask scrambling service
- `App.jsx` - React router, context providers
- `FingerprintContext.jsx` - Device tracking context
- `DeviceFingerprint.js` - Fingerprint collection utility
- `Auth.jsx` - Login/register with fingerprint submission
- `audioScrambler.js` - Standalone audio scrambling (Web Audio API)

## Special Notes

- **ID Generation:** Uses `VARCHAR(10)` with `Math.random().toString(36).substring(2, 12).toUpperCase()`
- **Notifications:** `CreateNotification()` helper function in `server.cjs` for user alerts
- **Multi-Terminal Development:** Always run frontend + Node + Flask together
- **Fingerprint Timing:** Generated on page load, submitted only after successful auth
- **Transaction Verification:** Blockchain transactions verified before credit award
