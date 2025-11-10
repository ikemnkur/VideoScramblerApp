# VideoScramblerApp - Content Protection Platform

A React-based platform for scrambling and unscrambling digital content with built-in leak prevention through device fingerprinting.

## Features

### 🔐 Content Protection
- **Photo Scrambling** - Browser-based image scrambling with watermarking
- **Photo Unscrambling** - Restore scrambled images with keys
- **Pro Version** - Server-side scrambling with advanced algorithms
- **Key Management** - Create, sell, and manage unlock keys
- **Secure Keys** - Cryptographically secure key generation

### 🛡️ Leak Prevention
- **Device Fingerprinting** - Track every device that unscrambles content
- **Automatic Tracking** - Fingerprints submitted on login/registration
- **Leak Detection** - Identify source of leaked content
- **Device Management** - View and manage authorized devices
- **Trust System** - Automatic blocking of compromised devices

### 💰 Monetization
- **Marketplace** - Buy and sell content unlock keys
- **Credits System** - Virtual currency for transactions
- **Earnings Tracking** - Monitor your revenue
- **Transaction History** - Complete purchase/sale records

### 👤 User Management
- **Authentication** - Secure login and registration
- **Account Types** - Buyer and seller roles
- **Profile Management** - Customize your account
- **Security Dashboard** - View login history and devices

## Tech Stack

- **Frontend:** React 18 + Vite
- **UI:** Material-UI v5
- **Backend:** Node.js + Express
- **Database:** MySQL
- **Server:** Flask (Python) for advanced scrambling
- **Image Processing:** Canvas API
- **Fingerprinting:** Multi-technique device identification

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- MySQL 8.0+
- Python 3.8+ (for Pro features)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/VideoScramblerApp.git
cd VideoScramblerApp
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up database**
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE KeyChingDB;"

# Run schema
mysql -u root -p KeyChingDB < database/schema/device_fingerprints.sql
```

4. **Configure environment**
```bash
# Create .env file
cp .env.example .env

# Edit with your settings
nano .env
```

Required environment variables:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=KeyChingDB
PORT=3001
VITE_API_SERVER_URL=http://localhost:3001
```

5. **Start backend server**
```bash
node old-server.cjs
```

6. **Start frontend (in another terminal)**
```bash
npm run dev
```

7. **Open browser**
```
http://localhost:5173
```

## Device Fingerprinting Setup

The app includes a comprehensive device fingerprinting system for leak prevention.

### Quick Setup (5 minutes)

Follow the **[Quick Start Guide](FINGERPRINT_QUICKSTART.md)** for step-by-step instructions.

### Documentation

- **[Setup Guide](FINGERPRINT_SETUP.md)** - Complete setup instructions
- **[Usage Guide](FINGERPRINT_GUIDE.md)** - How to use fingerprinting
- **[API Reference](FINGERPRINT_API.md)** - Endpoint documentation
- **[Summary](FINGERPRINT_SUMMARY.md)** - Implementation overview

### Key Features

✅ Automatic fingerprint generation on app load  
✅ Backend storage with MySQL  
✅ Login/registration integration  
✅ Device history tracking  
✅ Leak detection and prevention  
✅ Admin monitoring tools  

## Project Structure

```
VideoScramblerApp/
├── database/
│   └── schema/
│       └── device_fingerprints.sql       # Fingerprint database schema
├── src/
│   ├── api/                              # API clients
│   ├── assets/                           # Static assets
│   ├── components/                       # React components
│   │   ├── Auth.jsx                      # Login/registration
│   │   ├── DeviceHistory.jsx            # Device list component
│   │   ├── FingerprintDisplay.jsx       # Fingerprint UI
│   │   ├── KeyCard.jsx                   # Key marketplace card
│   │   └── ...
│   ├── contexts/                         # React contexts
│   │   ├── AuthContext.jsx              # Authentication state
│   │   ├── FingerprintContext.jsx       # Fingerprint state
│   │   └── ToastContext.jsx             # Notifications
│   ├── pages/                            # Page components
│   │   ├── ScramblerPhotos.jsx          # Browser scrambler
│   │   ├── ScramblerPhotosPro.jsx       # Server scrambler
│   │   ├── UnscramblerPhotos.jsx        # Image unscrambler
│   │   └── ...
│   ├── utils/                            # Utility functions
│   │   └── DeviceFingerprint.js         # Fingerprinting engine
│   ├── App.jsx                           # Main app component
│   └── main.jsx                          # Entry point
├── old-server.cjs                        # Express API server
├── app.py                                # Flask server (Pro features)
└── ...
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Fingerprinting
- `POST /api/fingerprint/save` - Save device fingerprint
- `GET /api/fingerprint/user/:userId` - Get user's devices
- `GET /api/fingerprint/details/:hash` - Get fingerprint details
- `POST /api/fingerprint/unscramble/:hash` - Record unscramble action
- `POST /api/fingerprint/leaked/:hash` - Mark device as leaked
- `PATCH /api/fingerprint/block/:id` - Block/unblock device
- `GET /api/fingerprint/stats` - Get statistics (admin)

### Content & Keys
- `GET /api/listings` - Get marketplace listings
- `POST /api/create-key` - Create new unlock key
- `POST /api/unlock/:keyId` - Purchase and unlock key
- `GET /api/purchases/:username` - Get purchase history
- `GET /api/redemptions/:username` - Get redemption history

See **[API Reference](FINGERPRINT_API.md)** for complete documentation.

## Usage Examples

### Creating and Selling Keys

1. Navigate to "Create Key" page
2. Upload your scrambled content
3. Set price and description
4. Publish to marketplace

### Buying and Unlocking Content

1. Browse marketplace listings
2. Purchase key with credits
3. Use key to unscramble content
4. Download unscrambled file

### Viewing Device History

```jsx
import DeviceHistory from './components/DeviceHistory';

function SecurityPage() {
  const userData = JSON.parse(localStorage.getItem('userdata'));
  
  return <DeviceHistory userId={userData.id} showCurrentDevice={true} />;
}
```

### Tracking Unscrambles

```jsx
import { useFingerprint } from './contexts/FingerprintContext';

function Unscrambler() {
  const { recordUnscramble, getEmbeddableFingerprint } = useFingerprint();
  
  const handleUnscramble = async () => {
    const fingerprint = getEmbeddableFingerprint();
    
    // Your unscramble logic with embedded fingerprint
    await unscrambleImage(image, key, fingerprint);
    
    // Record the action
    await recordUnscramble();
  };
}
```

## Security Features

- ✅ **Device Fingerprinting** - Unique identification per device
- ✅ **Leak Prevention** - Embedded fingerprints in unscrambled content
- ✅ **Automatic Blocking** - Compromised devices blocked automatically
- ✅ **Activity Tracking** - Monitor all content access
- ✅ **Trust System** - Device reputation scoring
- ✅ **Forensic Tools** - Identify leak sources

## Development

### Running in Development Mode

```bash
# Frontend (with hot reload)
npm run dev

# Backend
node old-server.cjs

# Pro Server (Python)
python3 app.py
```

### Building for Production

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Testing

### Test Fingerprinting

1. Login to create first fingerprint
2. Check browser console for logs
3. Verify database entry:
```sql
SELECT * FROM device_fingerprints ORDER BY created_at DESC LIMIT 5;
```

### Test Device History

1. Navigate to /devices or your security page
2. Should see current device highlighted
3. Login from different browser to see multiple devices

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For issues and questions:
- Check the [Documentation](FINGERPRINT_GUIDE.md)
- Review [Quick Start Guide](FINGERPRINT_QUICKSTART.md)
- Check [API Reference](FINGERPRINT_API.md)

## Acknowledgments

- React team for amazing framework
- Material-UI for beautiful components
- MySQL for reliable database
- Canvas API for image processing
- WebGL for advanced fingerprinting

---

**Built with ❤️ for content creators who need leak prevention**
