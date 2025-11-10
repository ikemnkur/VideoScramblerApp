# Device Fingerprint API Reference

Quick reference for all fingerprint-related API endpoints.

## Base URL
```
http://localhost:3001/api
```

---

## Endpoints

### 1. Save or Update Fingerprint
**POST** `/fingerprint/save`

Saves a new device fingerprint or updates an existing one if the same device logs in again.

**Request Body:**
```json
{
  "userId": 123,
  "fingerprintHash": "a3f5c9d2e8...",
  "shortHash": "a3f5c9d2e8b1f4a7",
  "deviceType": "Desktop",
  "browser": "Chrome 120.0",
  "os": "Windows",
  "screenResolution": "1920x1080",
  "timezone": "America/New_York",
  "language": "en-US",
  "ipAddress": "192.168.1.100",
  "fullFingerprint": {...},
  "compactFingerprint": {...},
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Fingerprint saved successfully",
  "fingerprint": {
    "id": 1,
    "user_id": 123,
    "fingerprint_hash": "a3f5c9d2e8...",
    "login_count": 1,
    "created_at": "2025-11-07T...",
    ...
  }
}
```

---

### 2. Get User's Devices
**GET** `/fingerprint/user/:userId`

Retrieves all devices associated with a user account.

**Parameters:**
- `userId` (path) - The user's ID

**Response:**
```json
{
  "success": true,
  "fingerprints": [
    {
      "id": 1,
      "fingerprint_hash": "a3f5c9d2e8...",
      "short_hash": "a3f5c9d2e8b1f4a7",
      "device_type": "Desktop",
      "browser": "Chrome 120.0",
      "os": "Windows",
      "screen_resolution": "1920x1080",
      "ip_address": "192.168.1.100",
      "first_seen": "2025-11-01T10:30:00Z",
      "last_seen": "2025-11-07T15:45:00Z",
      "login_count": 15,
      "unscramble_count": 5,
      "leaked_content_count": 0,
      "is_trusted": true,
      "is_blocked": false,
      "device_status": "active"
    },
    ...
  ]
}
```

**Device Status Values:**
- `active` - Last seen within 24 hours
- `recent` - Last seen within 7 days
- `inactive` - Last seen within 30 days
- `dormant` - Last seen over 30 days ago

---

### 3. Get Fingerprint Details
**GET** `/fingerprint/details/:hash`

Retrieves full details for a specific device fingerprint.

**Parameters:**
- `hash` (path) - The fingerprint hash (full or short)

**Response:**
```json
{
  "success": true,
  "fingerprint": {
    "id": 1,
    "user_id": 123,
    "fingerprint_hash": "a3f5c9d2e8...",
    "full_fingerprint": {...},
    "compact_fingerprint": {...},
    "user_agent": "Mozilla/5.0...",
    ...
  }
}
```

---

### 4. Record Unscramble Action
**POST** `/fingerprint/unscramble/:hash`

Increments the unscramble count when a device unscrambles content.

**Parameters:**
- `hash` (path) - The fingerprint hash

**Response:**
```json
{
  "success": true,
  "message": "Unscramble count incremented"
}
```

**Usage Example:**
```javascript
// After successful unscramble
await fetch(`${API_URL}/api/fingerprint/unscramble/${fingerprintHash}`, {
  method: 'POST'
});
```

---

### 5. Mark Device as Leaked
**POST** `/fingerprint/leaked/:hash`

Marks a device as leaked when content from this device is found on external platforms.

**Parameters:**
- `hash` (path) - The fingerprint hash

**Request Body:**
```json
{
  "reason": "Content leaked on external platform"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device marked as leaked and blocked"
}
```

**Side Effects:**
- Increments `leaked_content_count`
- Sets `is_trusted` to `false`
- Sets `is_blocked` to `true`
- Sets `block_reason` to provided reason

---

### 6. Block/Unblock Device
**PATCH** `/fingerprint/block/:id`

Manually block or unblock a device.

**Parameters:**
- `id` (path) - The device fingerprint ID

**Request Body:**
```json
{
  "isBlocked": true,
  "blockReason": "Suspicious activity detected"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device blocked successfully"
}
```

---

### 7. Get Statistics (Admin)
**GET** `/fingerprint/stats`

Retrieves overall statistics for admin dashboard.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_devices": 1234,
    "total_users": 567,
    "blocked_devices": 12,
    "devices_with_leaks": 8,
    "total_logins": 5678,
    "total_unscrambles": 890,
    "avg_logins_per_device": 4.6
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (fingerprint not found)
- `500` - Internal Server Error (database error)

---

## Frontend Usage Examples

### Save Fingerprint After Login

```javascript
import { useFingerprint } from './contexts/FingerprintContext';

function Auth() {
  const { submitFingerprint } = useFingerprint();
  
  const handleLogin = async (credentials) => {
    // Login logic...
    const user = await loginUser(credentials);
    
    // Submit fingerprint
    await submitFingerprint(user.id);
  };
}
```

### Display User's Devices

```javascript
import DeviceHistory from './components/DeviceHistory';

function SecurityPage() {
  const userData = JSON.parse(localStorage.getItem('userdata'));
  
  return (
    <DeviceHistory userId={userData.id} showCurrentDevice={true} />
  );
}
```

### Record Unscramble

```javascript
import { useFingerprint } from './contexts/FingerprintContext';

function Unscrambler() {
  const { recordUnscramble } = useFingerprint();
  
  const handleUnscramble = async () => {
    // Unscramble logic...
    await unscrambleContent();
    
    // Record the action
    await recordUnscramble();
  };
}
```

### Get User's Device List

```javascript
const { getUserDevices } = useFingerprint();

const devices = await getUserDevices(userId);
if (devices.success) {
  console.log('User devices:', devices.devices);
}
```

---

## Database Schema Quick Reference

### device_fingerprints Table

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | Foreign key to userData |
| fingerprint_hash | VARCHAR(64) | SHA-256 hash |
| short_hash | VARCHAR(16) | First 16 chars |
| device_type | VARCHAR(50) | Desktop/Mobile/Tablet |
| browser | VARCHAR(100) | Browser name and version |
| os | VARCHAR(100) | Operating system |
| screen_resolution | VARCHAR(50) | Screen size |
| timezone | VARCHAR(100) | Timezone |
| language | VARCHAR(50) | Language code |
| ip_address | VARCHAR(45) | IP address |
| full_fingerprint | JSON | Complete fingerprint data |
| compact_fingerprint | JSON | Compact version |
| first_seen | TIMESTAMP | First login time |
| last_seen | TIMESTAMP | Last login time |
| login_count | INT | Number of logins |
| unscramble_count | INT | Number of unscrambles |
| leaked_content_count | INT | Number of leaks |
| is_trusted | BOOLEAN | Trust status |
| is_blocked | BOOLEAN | Block status |
| block_reason | VARCHAR(255) | Block reason |
| user_agent | TEXT | Full user agent |

---

## Stored Procedures

### save_device_fingerprint
Handles insert or update logic for fingerprints.

```sql
CALL save_device_fingerprint(
  user_id,
  fingerprint_hash,
  short_hash,
  device_type,
  browser,
  os,
  screen_resolution,
  timezone,
  language,
  ip_address,
  full_fingerprint,
  compact_fingerprint,
  user_agent
);
```

### increment_unscramble_count
Increments unscramble counter.

```sql
CALL increment_unscramble_count(fingerprint_hash);
```

### mark_device_leaked
Marks device as leaked and blocks it.

```sql
CALL mark_device_leaked(fingerprint_hash, reason);
```

---

## Security Considerations

1. **Authentication Required**: All endpoints should verify user authentication
2. **Rate Limiting**: Implement rate limits to prevent abuse
3. **Data Privacy**: Full fingerprints contain sensitive data - handle carefully
4. **HTTPS Only**: Use HTTPS in production
5. **Input Validation**: Validate all input parameters
6. **SQL Injection**: Use parameterized queries (already implemented)

---

## Testing with cURL

### Save Fingerprint
```bash
curl -X POST http://localhost:3001/api/fingerprint/save \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "fingerprintHash": "test123hash",
    "shortHash": "test123",
    "deviceType": "Desktop",
    "browser": "Chrome 120.0",
    "os": "Windows",
    "screenResolution": "1920x1080",
    "timezone": "America/New_York",
    "language": "en-US",
    "fullFingerprint": {},
    "compactFingerprint": {}
  }'
```

### Get User Devices
```bash
curl http://localhost:3001/api/fingerprint/user/1
```

### Get Stats
```bash
curl http://localhost:3001/api/fingerprint/stats
```

---

## Related Documentation

- [FINGERPRINT_GUIDE.md](./FINGERPRINT_GUIDE.md) - Complete usage guide
- [FINGERPRINT_SETUP.md](./FINGERPRINT_SETUP.md) - Setup instructions
- [device_fingerprints.sql](./database/schema/device_fingerprints.sql) - Database schema

---

**Last Updated:** November 7, 2025
