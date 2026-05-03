# Quick Start Checklist - Device Fingerprinting

Use this checklist to quickly set up and verify your device fingerprinting system.

## ⚙️ Setup (5-10 minutes)

### Step 1: Database Setup
```bash
# Connect to MySQL
mysql -u root -p

# Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS KeyChingDB;

# Select database
USE KeyChingDB;

# Run the schema file
SOURCE /home/ikem/Documents/VideoScramblerApp/database/schema/device_fingerprints.sql;

# Verify table was created
SHOW TABLES;
DESCRIBE device_fingerprints;

# Exit MySQL
exit;
```

**✓ Expected Result:** Table `device_fingerprints` should appear in the list

---

### Step 2: Environment Configuration

Create or update `.env` file in project root:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=KeyChingDB

# Server
PORT=3001
VITE_API_SERVER_URL=http://localhost:3001
```

**✓ Expected Result:** File saved with correct credentials

---

### Step 3: Install Dependencies (if needed)

```bash
npm install
```

**✓ Expected Result:** All packages installed successfully

---

### Step 4: Start Backend Server

```bash
# In project root
node old-server.cjs
```

**✓ Expected Result:** You should see:
```
🚀 Express Server with MySQL is running on port 3001
🗄️  Database: KeyChingDB (MySQL)
...
   - POST /api/fingerprint/save
   - GET /api/fingerprint/user/:userId
```

---

### Step 5: Start Frontend

```bash
# In another terminal
npm run dev
```

**✓ Expected Result:** Vite dev server starts on http://localhost:5173

---

## 🧪 Testing (5 minutes)

### Test 1: Login with Fingerprint Submission

1. Open browser: http://localhost:5173
2. Navigate to login page
3. Open browser DevTools (F12) → Console tab
4. Login with test credentials
5. Watch console for:
   ```
   📤 Submitting fingerprint to backend: {...}
   ✅ Device fingerprint recorded
   ```

**✓ Pass:** Fingerprint logs appear without errors

**✗ Fail:** Check:
- Is backend server running?
- Is VITE_API_SERVER_URL correct?
- Check browser Network tab for API errors

---

### Test 2: Database Verification

```sql
-- In MySQL
USE KeyChingDB;

-- Check if fingerprint was saved
SELECT 
  id,
  user_id,
  short_hash,
  device_type,
  browser,
  login_count,
  created_at
FROM device_fingerprints
ORDER BY created_at DESC
LIMIT 5;
```

**✓ Pass:** You see a row with your user_id and device info

**✗ Fail:** Check:
- Did login succeed?
- Check server console for errors
- Check FingerprintProvider is wrapping your app

---

### Test 3: Multiple Logins (Same Device)

1. Logout from app
2. Login again with same account
3. Check database:

```sql
SELECT user_id, short_hash, login_count, last_seen
FROM device_fingerprints
WHERE user_id = YOUR_USER_ID;
```

**✓ Pass:** `login_count` incremented, `last_seen` updated

**✗ Fail:** Check stored procedure executed correctly

---

### Test 4: Different Browser (New Device)

1. Open app in different browser (Chrome → Firefox or vice versa)
2. Login with same account
3. Check database:

```sql
SELECT user_id, short_hash, browser, login_count
FROM device_fingerprints
WHERE user_id = YOUR_USER_ID;
```

**✓ Pass:** Two rows with different `short_hash` and `browser` values

**✗ Fail:** Fingerprints might be too similar (rare)

---

### Test 5: Device History Component

Add to your routes (e.g., in App.jsx):

```jsx
import DeviceHistory from './components/DeviceHistory';

// Add route
<Route path="/devices" element={
  <Container>
    <DeviceHistory 
      userId={JSON.parse(localStorage.getItem('userdata')||'{}').id} 
      showCurrentDevice={true} 
    />
  </Container>
} />
```

1. Navigate to /devices
2. Should see device cards with:
   - Device type icon
   - Browser name
   - Login count
   - Status badge
   - Current device highlighted

**✓ Pass:** Device cards display correctly

**✗ Fail:** Check getUserDevices() method in context

---

### Test 6: API Endpoints

Test with cURL or Postman:

```bash
# Get user devices
curl http://localhost:3001/api/fingerprint/user/1

# Get stats
curl http://localhost:3001/api/fingerprint/stats

# Record unscramble (replace with actual hash)
curl -X POST http://localhost:3001/api/fingerprint/unscramble/abc123
```

**✓ Pass:** Each returns JSON response with `"success": true`

**✗ Fail:** Check server is running and routes are loaded

---

## 🎯 Integration Checklist

Mark items as you complete them:

### Backend
- [ ] SQL schema executed successfully
- [ ] Server starts without errors
- [ ] Fingerprint endpoints respond
- [ ] Database connection working

### Frontend
- [ ] FingerprintProvider wraps app
- [ ] Auth.jsx imports useFingerprint
- [ ] Login triggers fingerprint submission
- [ ] Console shows fingerprint logs

### Database
- [ ] device_fingerprints table exists
- [ ] Foreign key to userData works
- [ ] Stored procedures created
- [ ] Test data appears after login

### Components
- [ ] DeviceHistory.jsx displays devices
- [ ] FingerprintDisplay.jsx shows data
- [ ] No console errors or warnings
- [ ] Styling looks correct

---

## 🐛 Common Issues & Solutions

### Issue: "Table 'KeyChingDB.device_fingerprints' doesn't exist"

**Solution:**
```bash
mysql -u root -p KeyChingDB < database/schema/device_fingerprints.sql
```

---

### Issue: "Cannot add foreign key constraint"

**Solution:** Check userData table has `id` column:
```sql
DESCRIBE userData;
```

If column name is different, update the foreign key in schema file.

---

### Issue: "Fingerprint not submitting"

**Solution:** 
1. Check FingerprintProvider wraps your app in main.jsx:
   ```jsx
   <FingerprintProvider>
     <App />
   </FingerprintProvider>
   ```

2. Check Auth.jsx imports:
   ```jsx
   import { useFingerprint } from '../contexts/FingerprintContext';
   ```

3. Check API_URL in .env:
   ```
   VITE_API_SERVER_URL=http://localhost:3001
   ```

---

### Issue: "CORS errors"

**Solution:** Server already has CORS enabled. Restart server:
```bash
# Stop server (Ctrl+C)
node old-server.cjs
```

---

### Issue: "Fingerprint is null/undefined"

**Solution:** Wait for fingerprint to load:
```jsx
const { fingerprint, loading } = useFingerprint();

if (loading) return <CircularProgress />;
if (!fingerprint) return <Alert>Fingerprint not available</Alert>;
```

---

## 📊 Success Indicators

You know it's working when:

✅ Login console shows: `✅ Device fingerprint recorded`
✅ Database has entries in `device_fingerprints` table
✅ Multiple logins increment `login_count`
✅ Device history page displays devices
✅ Different browsers create separate fingerprints
✅ Current device is highlighted in device list
✅ No errors in browser console
✅ No errors in server console

---

## 🎉 You're Done!

If all checkboxes are marked and tests pass, your fingerprinting system is **fully operational**!

### What Works Now:
- ✅ Automatic fingerprint generation
- ✅ Backend storage with MySQL
- ✅ Login/registration integration
- ✅ Device history tracking
- ✅ Activity monitoring
- ✅ Leak prevention infrastructure

### Next Steps:
1. Add device history to user account page
2. Implement email notifications for new devices
3. Add fingerprint embedding to unscrambler
4. Create admin monitoring dashboard
5. Implement leak detection workflow

---

## 📚 Documentation Reference

- **Setup Help:** `FINGERPRINT_SETUP.md`
- **API Reference:** `FINGERPRINT_API.md`
- **Usage Guide:** `FINGERPRINT_GUIDE.md`
- **Summary:** `FINGERPRINT_SUMMARY.md`

---

**Need Help?** 
1. Check documentation files
2. Review console logs (browser & server)
3. Verify database connection
4. Check .env configuration
5. Ensure all files are in correct locations

---

**Last Updated:** November 7, 2025
