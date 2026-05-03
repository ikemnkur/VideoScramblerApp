# Password Reset Setup Guide

## Overview
A complete password reset system has been added to the VideoScramblerApp with email verification using 6-digit codes.

## Features
- Email-based password reset flow
- 6-digit verification codes
- 15-minute expiration on reset codes
- Email confirmation after successful reset
- Clean, Material-UI styled pages
- Mobile-responsive design

## Files Created/Modified

### Frontend Pages
1. **`src/pages/ForgotPassword.jsx`** - Request password reset
   - User enters email
   - Sends reset code via email
   - Redirects to reset password page

2. **`src/pages/ResetPassword.jsx`** - Reset password with code
   - Enter email, reset code, and new password
   - Password visibility toggles
   - Validates code expiration
   - Shows success/error messages

### Backend API Endpoints (server.cjs)
1. **POST `/api/auth/forgot-password`**
   - Accepts: `{ email }`
   - Generates 6-digit code
   - Stores code and expiry in database
   - Sends email with reset code
   - Returns success regardless of email existence (security)

2. **POST `/api/auth/reset-password`**
   - Accepts: `{ email, resetCode, newPassword }`
   - Validates reset code and expiration
   - Hashes new password with bcrypt
   - Updates password in database
   - Clears reset code
   - Sends confirmation email

### Database Schema
**File:** `database/schema/password_reset.sql`

```sql
ALTER TABLE userData
ADD COLUMN resetCode VARCHAR(6) DEFAULT NULL,
ADD COLUMN resetCodeExpiry DATETIME DEFAULT NULL;

CREATE INDEX idx_reset_code ON userData(resetCode, resetCodeExpiry);
```

### Routing (App.jsx)
Added routes:
- `/forgot-password` - Request reset code
- `/reset-password` - Enter code and new password

## Setup Instructions

### 1. Database Setup
Run the SQL migration to add reset code fields:

```bash
mysql -u root -p KeyChingDB < database/schema/password_reset.sql
```

Or manually run:
```sql
ALTER TABLE userData
ADD COLUMN resetCode VARCHAR(6) DEFAULT NULL,
ADD COLUMN resetCodeExpiry DATETIME DEFAULT NULL;

CREATE INDEX idx_reset_code ON userData(resetCode, resetCodeExpiry);
```

### 2. Environment Variables
Ensure your `.env` file has email configuration:

```env
# Email Configuration (already in your setup)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="KeyChing Support <support@keyching.com>"
```

**Note:** For Gmail, you need to use an App Password:
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate an "App Password" for "Mail"
4. Use that password in `SMTP_PASS`

### 3. Restart Backend
After database changes, restart your Node backend:

```bash
# Stop the current server (Ctrl+C)
node server.cjs
# or
npm run server
```

### 4. Test the Flow
1. Navigate to `/login`
2. Click "Forgot your password?"
3. Enter your email
4. Check email for 6-digit code
5. Enter code and new password
6. Login with new password

## User Flow

```
Login Page
   ↓
[Forgot Password?] link
   ↓
/forgot-password
   ↓ (enter email)
Email sent with 6-digit code
   ↓
/reset-password
   ↓ (enter code + new password)
Password updated
   ↓
Redirect to /login
```

## Security Features

1. **Code Expiration:** Reset codes expire after 15 minutes
2. **Single Use:** Codes are cleared after successful reset
3. **Email Privacy:** System doesn't reveal if email exists
4. **Password Hashing:** Bcrypt with 12 rounds
5. **Validation:** Email format, password length (min 6 chars)
6. **Confirmation Emails:** Sent after successful reset

## Email Templates

### Reset Code Email
- Clear 6-digit code display
- Expiration notice (15 minutes)
- Security warning if not requested

### Confirmation Email
- Notifies user of successful password change
- Security alert to contact support if unauthorized

## Error Handling

### Frontend
- Email validation
- Password match validation
- Minimum password length
- Loading states with spinners
- Clear error/success messages

### Backend
- Database connection errors
- Email sending failures
- Invalid/expired codes
- Missing required fields
- Password hash failures

## API Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Reset code sent to your email"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Reset code has expired. Please request a new one."
}
```

## Troubleshooting

### Emails Not Sending
1. Check SMTP credentials in `.env`
2. Verify SMTP server is accessible
3. Check server logs: `console.log('Password reset code sent...')`
4. For Gmail, ensure "Less secure app access" or use App Password

### Database Errors
1. Verify columns exist: `DESCRIBE userData;`
2. Check for NULL constraints
3. Verify user exists with email

### Code Expired
- Codes expire after 15 minutes
- User must request a new code
- Check system time on server

## Customization

### Change Code Expiration Time
In `server.cjs` line ~1700:
```javascript
const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // Change 15 to desired minutes
```

### Change Code Length
In `server.cjs` line ~1698:
```javascript
const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
// For 4 digits: Math.floor(1000 + Math.random() * 9000)
```

### Email Styling
Modify HTML templates in:
- `/api/auth/forgot-password` route (~line 1707)
- `/api/auth/reset-password` route (~line 1833)

## Integration with Existing Auth

The password reset system integrates seamlessly:
- Uses existing `Auth.jsx` login flow
- Works with existing JWT tokens
- Uses same bcrypt hashing as registration
- Follows same email patterns as verification

## Next Steps (Optional Enhancements)

1. **Rate Limiting:** Prevent abuse by limiting reset requests per IP
2. **SMS Codes:** Add phone number verification option
3. **Magic Links:** Email-based passwordless login
4. **2FA Integration:** Require 2FA code for password reset
5. **Admin Panel:** View/manage reset requests
6. **Audit Log:** Track password reset attempts

## Support

If users encounter issues:
1. Check email spam folder
2. Verify email is correct
3. Request new code if expired
4. Contact support for manual reset

---

**Note:** The "Forgot Password?" link is already visible on the login page in Auth.jsx.
