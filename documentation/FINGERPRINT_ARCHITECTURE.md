# Device Fingerprinting System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDEOSC RAMBLERAPP                                 │
│                      Device Fingerprinting System                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐        ┌──────────────────────┐                 │
│  │   DeviceFingerprint   │        │  FingerprintContext  │                 │
│  │      (Utility)        │◄───────┤   (React Context)    │                 │
│  └──────────────────────┘        └──────────────────────┘                 │
│           │                                 │                               │
│           │ Generates                       │ Provides                      │
│           │ Fingerprint                     │ Methods                       │
│           ▼                                 ▼                               │
│  ┌─────────────────────────────────────────────────────┐                  │
│  │         Fingerprint Data Collection                  │                  │
│  ├─────────────────────────────────────────────────────┤                  │
│  │ • Browser Info (name, version, UA)                   │                  │
│  │ • Device Info (type, platform, memory)               │                  │
│  │ • Screen Data (resolution, DPI)                      │                  │
│  │ • Canvas Fingerprint                                 │                  │
│  │ • WebGL Fingerprint (GPU info)                       │                  │
│  │ • Audio Fingerprint                                  │                  │
│  │ • Network Info (IP, connection)                      │                  │
│  │ • Timezone, Language, Fonts                          │                  │
│  │ • SHA-256 Hash Generation                            │                  │
│  └─────────────────────────────────────────────────────┘                  │
│           │                                                                 │
│           │ Used By                                                         │
│           ▼                                                                 │
│  ┌──────────────────────┬──────────────────────┬────────────────────────┐ │
│  │      Auth.jsx        │   DeviceHistory.jsx   │   Unscrambler.jsx     │ │
│  │  (Login/Register)    │   (Display Devices)   │   (Track Usage)       │ │
│  └──────────────────────┴──────────────────────┴────────────────────────┘ │
│           │                         │                        │              │
└───────────┼─────────────────────────┼────────────────────────┼──────────────┘
            │                         │                        │
            │ Submit                  │ Fetch                  │ Record
            │ After Login             │ Devices                │ Unscramble
            ▼                         ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND API (Express)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  POST /api/fingerprint/save                                                 │
│    ├─ Receives: userId, fingerprintHash, deviceInfo, fullFingerprint        │
│    ├─ Checks: Duplicate detection (same device?)                            │
│    ├─ Action: Insert new OR update login_count + last_seen                  │
│    └─ Returns: Saved fingerprint record                                     │
│                                                                              │
│  GET /api/fingerprint/user/:userId                                          │
│    ├─ Receives: userId                                                      │
│    ├─ Query: All devices for user, with status calculation                  │
│    └─ Returns: Array of device fingerprints                                 │
│                                                                              │
│  POST /api/fingerprint/unscramble/:hash                                     │
│    ├─ Receives: fingerprintHash                                             │
│    ├─ Action: Increment unscramble_count, update last_unscramble            │
│    └─ Returns: Success confirmation                                         │
│                                                                              │
│  POST /api/fingerprint/leaked/:hash                                         │
│    ├─ Receives: fingerprintHash, reason                                     │
│    ├─ Action: Increment leaked_content_count, set is_blocked=true           │
│    └─ Returns: Device blocked confirmation                                  │
│                                                                              │
│  Other endpoints: /details/:hash, /block/:id, /stats                        │
│                                                                              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ SQL Queries
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (MySQL)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    device_fingerprints TABLE                           │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  PRIMARY KEY: id                                                       │ │
│  │  FOREIGN KEY: user_id → userData(id)                                   │ │
│  │                                                                        │ │
│  │  Identity Fields:                                                      │ │
│  │    • fingerprint_hash (VARCHAR 64) - SHA-256 hash                     │ │
│  │    • short_hash (VARCHAR 16) - First 16 chars                         │ │
│  │                                                                        │ │
│  │  Device Info:                                                          │ │
│  │    • device_type (VARCHAR 50) - Desktop/Mobile/Tablet                 │ │
│  │    • browser (VARCHAR 100) - Name + version                           │ │
│  │    • os (VARCHAR 100) - Operating system                              │ │
│  │    • screen_resolution (VARCHAR 50) - Display size                    │ │
│  │    • timezone (VARCHAR 100) - User timezone                           │ │
│  │    • language (VARCHAR 50) - Preferred language                       │ │
│  │    • ip_address (VARCHAR 45) - IP address                             │ │
│  │                                                                        │ │
│  │  Fingerprint Data (JSON):                                              │ │
│  │    • full_fingerprint - Complete data                                  │ │
│  │    • compact_fingerprint - Lightweight version                         │ │
│  │                                                                        │ │
│  │  Activity Tracking:                                                    │ │
│  │    • first_seen (TIMESTAMP) - First login                             │ │
│  │    • last_seen (TIMESTAMP) - Most recent login                        │ │
│  │    • login_count (INT) - Number of logins                             │ │
│  │    • unscramble_count (INT) - Content accesses                        │ │
│  │    • last_unscramble (TIMESTAMP) - Last unscramble                    │ │
│  │                                                                        │ │
│  │  Security Status:                                                      │ │
│  │    • is_trusted (BOOLEAN) - Trust flag                                │ │
│  │    • is_blocked (BOOLEAN) - Block flag                                │ │
│  │    • block_reason (VARCHAR 255) - Why blocked                         │ │
│  │    • leaked_content_count (INT) - Leak incidents                      │ │
│  │                                                                        │ │
│  │  Metadata:                                                             │ │
│  │    • user_agent (TEXT) - Full UA string                               │ │
│  │    • created_at (TIMESTAMP) - Record creation                         │ │
│  │    • updated_at (TIMESTAMP) - Last modification                       │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      STORED PROCEDURES                                 │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  save_device_fingerprint(...)                                          │ │
│  │    ├─ IF EXISTS: UPDATE login_count, last_seen                        │ │
│  │    └─ ELSE: INSERT new record                                         │ │
│  │                                                                        │ │
│  │  increment_unscramble_count(hash)                                      │ │
│  │    └─ UPDATE unscramble_count++, last_unscramble                      │ │
│  │                                                                        │ │
│  │  mark_device_leaked(hash, reason)                                      │ │
│  │    └─ UPDATE leaked_content_count++, is_blocked, block_reason         │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         INDEXES                                        │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │  • PRIMARY KEY (id)                                                    │ │
│  │  • INDEX (user_id) - Fast user lookups                                │ │
│  │  • INDEX (fingerprint_hash) - Fast hash lookups                       │ │
│  │  • INDEX (short_hash) - Quick comparisons                             │ │
│  │  • UNIQUE (user_id, fingerprint_hash) - No duplicates                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW DIAGRAM                                 │
└─────────────────────────────────────────────────────────────────────────────┘

USER REGISTRATION/LOGIN:
1. User fills login form
2. React calls handleCaptchaSuccess()
3. Auth request sent to backend
4. Backend validates credentials
5. User data stored in localStorage
6. submitFingerprint(userId) called
7. Fingerprint data sent to /api/fingerprint/save
8. Backend calls save_device_fingerprint() procedure
9. Database INSERT or UPDATE executed
10. Success response returned
11. User navigated to dashboard

VIEWING DEVICE HISTORY:
1. User navigates to security/devices page
2. DeviceHistory component mounts
3. getUserDevices(userId) called
4. GET /api/fingerprint/user/:userId
5. Backend queries device_fingerprints table
6. Results include device_status calculation
7. Array of devices returned
8. Component renders device cards
9. Current device highlighted

UNSCRAMBLING CONTENT:
1. User selects content to unscramble
2. getEmbeddableFingerprint() called
3. Compact fingerprint encoded
4. Fingerprint embedded in image metadata
5. Unscramble process executes
6. recordUnscramble() called
7. POST /api/fingerprint/unscramble/:hash
8. Backend increments unscramble_count
9. User downloads unscrambled content

LEAK DETECTION:
1. Leaked content discovered
2. Fingerprint extracted from metadata
3. decodeFingerprint(encoded) called
4. User/device identified
5. POST /api/fingerprint/leaked/:hash with reason
6. Backend calls mark_device_leaked()
7. Database sets is_blocked=true
8. leaked_content_count incremented
9. User notified of security breach


┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

FINGERPRINT GENERATION:
┌──────────────┐
│   Browser    │
│  Collection  │─┐
└──────────────┘ │
                 │  ┌──────────────────┐
┌──────────────┐ ├─►│  Combined Data   │
│   Canvas     │ │  │   (JSON Object)  │
│ Fingerprint  │─┤  └──────────────────┘
└──────────────┘ │           │
                 │           ▼
┌──────────────┐ │  ┌──────────────────┐
│    WebGL     │ │  │   SHA-256 Hash   │
│ Fingerprint  │─┤  │  (64 characters) │
└──────────────┘ │  └──────────────────┘
                 │           │
┌──────────────┐ │           ▼
│    Audio     │ │  ┌──────────────────┐
│ Fingerprint  │─┘  │  Short Hash (16) │
└──────────────┘    │   + Full Data    │
                    └──────────────────┘

LEAK PREVENTION WORKFLOW:

Content Creation → Scrambling → Marketplace Listing
                                       │
                                       ▼
                           User Purchases Key
                                       │
                                       ▼
                        Fingerprint Embedded ◄───┐
                                       │          │
                                       ▼          │
                            Unscrambled Content   │
                                       │          │
                                       ▼          │
                            Content Downloaded    │
                                       │          │
                                       ▼          │
                        IF LEAKED: Extract ───────┘
                                       │
                                       ▼
                        Identify User & Device
                                       │
                                       ▼
                            Block Device
                                       │
                                       ▼
                            Notify Admin
                                       │
                                       ▼
                        Take Legal Action


┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMPONENT INTERACTION MAP                                │
└─────────────────────────────────────────────────────────────────────────────┘

main.jsx
  └── FingerprintProvider
        ├── App.jsx
        │     ├── Auth.jsx
        │     │     └── useFingerprint() → submitFingerprint()
        │     │
        │     ├── DeviceHistory.jsx
        │     │     └── useFingerprint() → getUserDevices()
        │     │
        │     ├── UnscramblerPhotos.jsx
        │     │     └── useFingerprint() → recordUnscramble()
        │     │
        │     └── FingerprintDisplay.jsx
        │           └── useFingerprint() → fingerprint, compactFingerprint
        │
        └── FingerprintContext
              ├── DeviceFingerprint.generate()
              ├── DeviceFingerprint.getCompactFingerprint()
              ├── DeviceFingerprint.encodeForEmbedding()
              └── API calls to backend


┌─────────────────────────────────────────────────────────────────────────────┐
│                          FILES & STRUCTURE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

VideoScramblerApp/
│
├── 📁 database/
│   └── 📁 schema/
│       └── 📄 device_fingerprints.sql         [Database schema + procedures]
│
├── 📁 src/
│   ├── 📁 utils/
│   │   └── 📄 DeviceFingerprint.js            [Core fingerprinting engine]
│   │
│   ├── 📁 contexts/
│   │   └── 📄 FingerprintContext.jsx          [React Context Provider]
│   │
│   └── 📁 components/
│       ├── 📄 Auth.jsx                        [Login with fingerprint submit]
│       ├── 📄 DeviceHistory.jsx               [Device list component]
│       └── 📄 FingerprintDisplay.jsx          [Fingerprint viewer]
│
├── 📄 old-server.cjs                          [Express API with endpoints]
│
└── 📁 Documentation/
    ├── 📄 FINGERPRINT_GUIDE.md                [Complete usage guide]
    ├── 📄 FINGERPRINT_SETUP.md                [Setup instructions]
    ├── 📄 FINGERPRINT_API.md                  [API reference]
    ├── 📄 FINGERPRINT_SUMMARY.md              [Implementation summary]
    ├── 📄 FINGERPRINT_QUICKSTART.md           [Quick start checklist]
    └── 📄 FINGERPRINT_ARCHITECTURE.md         [This file]


┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT CHECKLIST                                 │
└─────────────────────────────────────────────────────────────────────────────┘

□ Database Setup
  □ Create KeyChingDB database
  □ Run device_fingerprints.sql schema
  □ Verify tables and procedures created
  □ Test foreign key constraints

□ Backend Configuration
  □ Set environment variables (.env)
  □ Configure database connection
  □ Start Express server
  □ Verify fingerprint endpoints working

□ Frontend Configuration
  □ Wrap app with FingerprintProvider
  □ Import useFingerprint in Auth.jsx
  □ Configure VITE_API_SERVER_URL
  □ Test fingerprint generation

□ Integration Testing
  □ Test login fingerprint submission
  □ Verify database records created
  □ Test device history display
  □ Test unscramble tracking
  □ Test leak marking

□ Security Audit
  □ Enable HTTPS in production
  □ Implement rate limiting
  □ Add authentication to endpoints
  □ Encrypt sensitive fingerprint data
  □ Review privacy policy

□ Documentation
  □ Update README.md
  □ Add API documentation
  □ Create user guides
  □ Document admin procedures


END OF ARCHITECTURE DOCUMENTATION
