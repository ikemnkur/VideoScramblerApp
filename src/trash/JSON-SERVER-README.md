# Video Scrambler App JSON Server Database

This is a JSON Server setup for testing and developing the Scramblurr App. It provides a complete REST API with realistic mock data.

## Setup Instructions

### 1. Install JSON Server

```bash
# Navigate to your project directory
cd /home/ikem/Documents/Video Scrambler-App

# Install JSON Server globally (recommended)
npm install -g json-server

# Or install locally
npm install json-server --save-dev
```

### 2. Start the Server

**Option A: Simple JSON Server**
```bash
json-server --watch db.json --port 3001
```

**Option B: Custom Server with Additional Routes**
```bash
# Install dependencies first
npm install json-server cors

# Start custom server
node server.js
```

**Option C: Using Package Scripts**
```bash
# Copy server-package.json to package.json first
cp server-package.json package.json

# Install dependencies
npm install

# Start server
npm start

# Or start with delay (simulates slower API)
npm run dev
```

## API Endpoints

### Base URL: `http://localhost:3001/api`

### Standard REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/userData` | Get all users |
| GET | `/userData/:id` | Get user by ID |
| GET | `/createdKeys` | Get all key listings |
| GET | `/createdKeys/:id` | Get key by ID |
| GET | `/unlocks` | Get all unlock records |
| GET | `/buyCredits` | Get credit purchase records |
| GET | `/redeemCredits` | Get credit redemption records |
| GET | `/earnings` | Get seller earnings |
| GET | `/notifications` | Get all notifications |
| GET | `/wallet` | Get wallet information |

### Custom API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User authentication |
| GET | `/wallet/balance` | Get user wallet balance |
| POST | `/unlock/:keyId` | Unlock a key |
| GET | `/seller/listings/:id` | Get seller listing by ID |
| GET | `/listings` | Get all active listings |
| GET | `/notifications/:username` | Get notifications for user |
| POST | `/host/upload` | Upload new key listing |

## Sample API Calls

### Authentication
```bash
curl -X POST http://localhost:3001/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "user_123", "password": "demo123"}'
```

### Get User Balance
```bash
curl http://localhost:3001/api/wallet/balance?username=user_123
```

### Unlock a Key
```bash
curl -X POST http://localhost:3001/api/unlock/1 \\
  -H "Content-Type: application/json"
```

### Upload New Keys
```bash
curl -X POST http://localhost:3001/api/host/upload \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Test Keys", "price_credits": 150}'
```

## Database Structure

The `db.json` file contains the following collections:

- **userData**: User accounts and profiles
- **buyCredits**: Credit purchase transactions
- **redeemCredits**: Credit redemption requests
- **earnings**: Seller earnings history
- **unlocks**: Key unlock/purchase records
- **createdKeys**: Key listings created by sellers
- **notifications**: User notifications
- **wallet**: Wallet balances and statistics

## Demo Users

### Buyer Account
- **Username**: `user_123`
- **Password**: `demo123` (for login API)
- **Credits**: 750
- **Email**: john.buyer@example.com

### Seller Account
- **Username**: `seller_123`  
- **Password**: `demo123` (for login API)
- **Credits**: 2350
- **Email**: jane.seller@example.com

### Additional User
- **Username**: `keycollector`
- **Password**: `demo123` (for login API)
- **Credits**: 125
- **Email**: collector@example.com

## Features

### Realistic Data
- Proper timestamps and dates
- Realistic usernames, emails, and transaction data
- Multiple key types (Windows, Steam, Netflix, Office)
- Various transaction statuses and types

### Custom Routes
- Authentication simulation
- Dynamic key unlocking with random key generation  
- Inventory management (decreases available keys)
- File upload simulation
- User-specific data filtering

### Development Features
- CORS enabled for frontend development
- Configurable delays for testing loading states
- Error simulation for testing error handling
- Automatic database updates for state changes

## Integration with React App

Update your React app's API client to point to the JSON Server:

```javascript
// In your api/client.js or similar
const API_BASE_URL = 'http://localhost:3001/api';

// Example usage
const response = await fetch(`${API_BASE_URL}/wallet/balance?username=user_123`);
const data = await response.json();
```

## Troubleshooting

### Port Already in Use
If port 3001 is busy, use a different port:
```bash
json-server --watch db.json --port 3002
```

### CORS Issues
The custom server includes CORS middleware. If using basic JSON Server, add:
```bash
json-server --watch db.json --port 3001 --middlewares cors
```

### Database Reset
To reset the database to original state, delete and recreate `db.json` from the original data structure.

## Extending the Database

To add more data or modify existing data:

1. Edit `db.json` directly
2. Server will automatically reload with `--watch` flag
3. Add new custom routes in `server.js` for complex operations
4. Use JSON Server's built-in filtering, pagination, and sorting

Example filtering:
```
GET /api/createdKeys?username=seller_123&isActive=true
GET /api/notifications?username=user_123&isRead=false
GET /api/unlocks?status=Completed&_sort=date&_order=desc
```

This setup provides a complete backend simulation for developing and testing your Video Scrambler App!