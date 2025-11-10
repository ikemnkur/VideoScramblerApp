# Device Fingerprinting Backend Setup Guide

This guide will help you set up the device fingerprinting system with MySQL backend integration.

## Prerequisites

- MySQL Server installed and running
- Node.js and npm installed
- Your VideoScramblerApp project

## Step 1: Database Setup

### 1.1 Create the Database Table

Run the SQL script to create the `device_fingerprints` table:

```bash
mysql -u root -p KeyChingDB < database/schema/device_fingerprints.sql
```

Or manually execute the SQL in your MySQL client:

```sql
-- Open MySQL command line
mysql -u root -p

-- Select your database
USE KeyChingDB;

-- Run the schema file
SOURCE /path/to/VideoScramblerApp/database/schema/device_fingerprints.sql;

-- Verify table was created
SHOW TABLES;
DESCRIBE device_fingerprints;
```

### 1.2 Verify Foreign Key Relationship

Make sure your `userData` table exists with an `id` column:

```sql
DESCRIBE userData;
```

If the foreign key constraint fails, you may need to adjust it in the schema file to match your existing table structure.

## Step 2: Update Server Configuration

### 2.1 Environment Variables

Create or update your `.env` file in the project root:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=KeyChingDB
DB_CONNECTION_LIMIT=10

# Server Configuration
PORT=3001
API_SERVER_URL=http://localhost:3001

# Frontend Configuration (for Vite)
VITE_API_SERVER_URL=http://localhost:3001
```

### 2.2 Verify Server Endpoints

The fingerprint endpoints have been added to `old-server.cjs`:

- `POST /api/fingerprint/save` - Save or update device fingerprint
- `GET /api/fingerprint/user/:userId` - Get all devices for a user
- `GET /api/fingerprint/details/:hash` - Get fingerprint details by hash
- `POST /api/fingerprint/unscramble/:hash` - Increment unscramble count
- `POST /api/fingerprint/leaked/:hash` - Mark device as leaked
- `PATCH /api/fingerprint/block/:id` - Block/unblock device
- `GET /api/fingerprint/stats` - Get admin statistics

## Step 3: Frontend Integration

### 3.1 Wrap Your App with FingerprintProvider

Update `main.jsx` or `App.jsx`:

```jsx
import { FingerprintProvider } from './contexts/FingerprintContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FingerprintProvider>
          {/* Your app routes and components */}
        </FingerprintProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
```

### 3.2 Authentication Integration

The fingerprint is automatically submitted after login/registration in `Auth.jsx`. No additional changes needed!

When a user logs in or registers:
1. Fingerprint is generated in the background
2. After successful authentication, `submitFingerprint()` is called
3. Device info is saved to the database
4. User can continue using the app

## Step 4: Testing the Integration

### 4.1 Start the Server

```bash
# In your project directory
node old-server.cjs
```

You should see:
```
🚀 Express Server with MySQL is running on port 3001
🗄️  Database: KeyChingDB (MySQL)
🌐 API Base URL: http://localhost:3001/api
📋 Available endpoints:
   ...
   - POST /api/fingerprint/save
   - GET /api/fingerprint/user/:userId
   ...
```

### 4.2 Start the Frontend

```bash
npm run dev
```

### 4.3 Test Login Flow

1. Open http://localhost:5173 (or your Vite dev port)
2. Login or register a new account
3. Check the browser console for fingerprint logs:
   ```
   📤 Submitting fingerprint to backend: {...}
   ✅ Device fingerprint recorded
   ```

4. Check the database:
   ```sql
   SELECT * FROM device_fingerprints ORDER BY created_at DESC LIMIT 5;
   ```

### 4.4 Test Device History Component

Create a test page to view device history:

```jsx
// pages/Security.jsx
import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import DeviceHistory from '../components/DeviceHistory';

function Security() {
  // Get current user ID from localStorage
  const userData = JSON.parse(localStorage.getItem('userdata') || '{}');
  const userId = userData.id;

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Security & Device Management
        </Typography>
        
        {userId ? (
          <DeviceHistory userId={userId} showCurrentDevice={true} />
        ) : (
          <Typography>Please log in to view device history</Typography>
        )}
      </Box>
    </Container>
  );
}

export default Security;
```

## Step 5: Using Fingerprints for Leak Prevention

### 5.1 In Your Unscrambler Component

```jsx
import { useFingerprint } from '../contexts/FingerprintContext';

function UnscramblerPhotosPro() {
  const { 
    getEmbeddableFingerprint, 
    compactFingerprint,
    recordUnscramble 
  } = useFingerprint();

  const handleUnscramble = async () => {
    // Get fingerprint to embed
    const fingerprintData = getEmbeddableFingerprint();
    
    // Your unscramble logic...
    const result = await unscrambleImage(image, key, fingerprintData);
    
    // Record the unscramble action
    await recordUnscramble();
    
    return result;
  };

  return (
    // Your component UI
  );
}
```

### 5.2 Track Leaked Content

When you detect leaked content:

```javascript
// In your leak detection system
async function handleLeakedContent(leakedImage) {
  // Extract fingerprint from leaked image
  const fingerprint = extractFingerprintFromImage(leakedImage);
  
  if (fingerprint && fingerprint.hash) {
    // Mark device as leaked in database
    await fetch(`${API_URL}/api/fingerprint/leaked/${fingerprint.hash}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Content leaked on external platform'
      })
    });
    
    // Device is now marked as blocked and untrusted
    // User will see security warning on next login
  }
}
```

## Step 6: Admin Dashboard (Optional)

### 6.1 Create Admin Stats Page

```jsx
// pages/AdminFingerprints.jsx
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent,
  CircularProgress 
} from '@mui/material';

function AdminFingerprints() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/fingerprint/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Device Fingerprint Statistics
        </Typography>
        
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Devices
                </Typography>
                <Typography variant="h4">
                  {stats?.total_devices || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Users
                </Typography>
                <Typography variant="h4">
                  {stats?.total_users || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Blocked Devices
                </Typography>
                <Typography variant="h4" color="error">
                  {stats?.blocked_devices || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Devices with Leaks
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats?.devices_with_leaks || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default AdminFingerprints;
```

## Troubleshooting

### Issue: "Table doesn't exist"

**Solution:** Make sure you ran the SQL schema file:
```bash
mysql -u root -p KeyChingDB < database/schema/device_fingerprints.sql
```

### Issue: "Foreign key constraint fails"

**Solution:** Check if `userData` table exists and has `id` column:
```sql
DESCRIBE userData;
```

If column name is different, update the foreign key in the schema file.

### Issue: "Fingerprint not submitting"

**Solution:** 
1. Check browser console for errors
2. Verify FingerprintProvider wraps your app
3. Check that API_URL is correct in .env
4. Make sure server is running on port 3001

### Issue: "CORS errors"

**Solution:** Server already has CORS enabled. If still getting errors, update CORS config in `old-server.cjs`:
```javascript
server.use(cors({
  origin: 'http://localhost:5173', // Your Vite dev server
  credentials: true
}));
```

## Security Best Practices

1. **Encrypt Sensitive Data**: Consider encrypting the `full_fingerprint` JSON column
2. **Rate Limiting**: Add rate limiting to fingerprint endpoints
3. **Authentication**: Ensure fingerprint endpoints check user authentication
4. **Privacy Policy**: Update your privacy policy to mention fingerprinting
5. **User Consent**: Show users what data is collected
6. **Regular Cleanup**: Remove old/dormant device fingerprints after 1 year

## Next Steps

1. ✅ Database table created
2. ✅ Server endpoints working
3. ✅ Frontend integration complete
4. ✅ Login flow captures fingerprints
5. ✅ Device history component ready

**Optional Enhancements:**
- Add email notifications for new device logins
- Implement device nickname/naming feature
- Add 2FA requirement for suspicious devices
- Create device management dashboard
- Add geolocation based on IP address
- Implement device trust scoring algorithm

## Testing Checklist

- [ ] SQL schema executed successfully
- [ ] Server starts without errors
- [ ] Login creates fingerprint in database
- [ ] Device history page displays devices
- [ ] Multiple logins from same device increment login_count
- [ ] Different browsers create separate fingerprints
- [ ] Current device is highlighted in device history
- [ ] Fingerprint data looks correct in database

## Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs for errors
3. Verify database connection
4. Check that all files are in correct locations
5. Review the FINGERPRINT_GUIDE.md for usage examples

Happy fingerprinting! 🔒
