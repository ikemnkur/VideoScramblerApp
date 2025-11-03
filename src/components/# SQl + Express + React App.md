# SQl + Express + React App


## Create the backend



# Stucture for the DB:


userData :  [ 
    loginStatus: false,
    lastlogin: null,
    accountType: '', // 'buyer' or 'seller'
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    birthDate: '',
    encryptionKey: '',
    credits: 0,
    reportCount: 0,
    isBanned: false,
    banReason: '',
    banDate: null,
    banDuration: null, // in days
    createdAt: Date.now(),
    updatedAt: Date.now(),
    passwordHash: '',
    twoFactorEnabled: false,
    twoFactorSecret: '',
    recoveryCodes: [],
    profilePicture: '',
    bio: '',
    socialLinks: {
      facebook: '',
      twitter: '',
      instagram: '',
      linkedin: '',
      website: ''
    }
  ]

Buy_Credits :  [   
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    birthDate: '',
    encryptionKey: '',
    Date:  Date.now(),
    Time: new Date().toLocaleTimeString(),
    currency: '{"LTC", "BTC", "ETH", "XMR", "SOL", "DOGE", "USDT", "USDC"}',
    amount: 0,
    walletAddress: '',
    credits: 0,
    username: '',
    email: '',
  ]



Redeem_Credits :  [{ 
    firstName: '',
    lastName: '',
    phoneNumber: '',
    birthDate: '',
    encryptionKey: '',
    currency: '{"LTC", "BTC", "ETH", "XMR", "SOL", "DOGE", "USDT", "USDC"}',
    amount: 0,
    walletAddress: '',
    credits: 0,
    fee: 0,
    totalDeduction: 0,
    Date:  Date.now(),
    Time: new Date().toLocaleTimeString(),
    username: '',
    email: '',
}]

# Example Earnings DB Table Format with Randomized Data
# FOr seller // sellers  history of transactions

earnings: [
    transactionTypes = ['Key Sale', 'Earnings Payout', 'Platform Fee', 'Refund'];
    statuses = ['Completed', 'Processing', 'Pending', 'Failed'];
    buyers = ['buyer123', 'keycollector', 'gamer456', 'techuser', 'cryptofan']; // example buyer usernames
    keyTitles = [ // example key titles
      'Premium Game License Key',
      'Antivirus Software License',
      'Microsoft Office Professional',
      'Adobe Creative Suite',
      'Steam Gift Card Code',
      'Windows 10 Pro License',
      'Spotify Premium Account',
      'Netflix Premium Access',
      'VPN Service Key',
      'Cloud Storage License'
    ];
    
    dates: [
      new Date(currentTime.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      for _ in [1..50]
    ];
    earningsData = [
      {
        id: i + 1,
        date: dates[i],
        transactionType: transactionTypes[Math.floor(Math.random() * transactionTypes.length)],
        keyTitle: keyTitles[Math.floor(Math.random() * keyTitles.length)],
        buyer: buyers[Math.floor(Math.random() * buyers.length)],
        amount: parseFloat((Math.random() * 100).toFixed(2)),
        status: statuses[Math.floor(Math.random() * statuses.length)]
      }
      for i in [0..49]
    ];

]   

// example unlock records structure
# Example Unlock DB Table Format
# effectively  history of transactions for buyers
unlocks :  [ 
   
    {
        TransactionID: 21,
        username: '',
        email: '',
        Date:  Date.now(),
        Time: new Date().toLocaleTimeString(),
        credits: 0,
        keyID: '',
        keyTitle: '',
        keyValue: '',
        sellerUsername: '',
        sellerEmail: '',
        price: 0,
        status: 'Pending', // 'Pending', 'Completed', 'Failed'
    },
   {
        TransactionID: 23,
        username: '',
        email: '',
        Date:  Date.now(),
        Time: new Date().toLocaleTimeString(),
        credits: 0,
        keyID: '',
        keyTitle: '',
        keyValue: '',
        sellerUsername: '',
        sellerEmail: '',
        price: 0,
        status: 'Pending', // 'Pending', 'Completed', 'Failed'
    },{
        TransactionID: 13,
        username: '',
        email: '',
        Date:  Date.now(),
        Time: new Date().toLocaleTimeString(),
        credits: 0,
        keyID: '',
        keyTitle: '',
        keyValue: '',
        sellerUsername: '',
        sellerEmail: '',
        price: 0,
        status: 'Pending', // 'Pending', 'Completed', 'Failed'
    },
    
]

# Example Key DB Table Format
Created_keys :  [
    keyID: '',
    username: '',
    email: '',
    keyTitle: '',
    keyValue: '',
    description: '',
    price: 0,
    quantity: 0,
    sold: 0,
    available: 0,

    creationDate: Date.now(),
    expirationDate: null,
   
    isActive: true,
    isReported: false,
    reportCount: 0,
    encryptionKey: '',
    tags: [],
]

# Example Notifications DB Table Format
# for both buyers and sellers
notifications: [
    // Key Buyer Notifications
    {
    id: 1,
    type: 'key_purchased',
    title: 'Key Purchase Successful',
    message: 'You purchased "Windows Pro License Key" for 250 credits.',
    created_at: new Date(currentTime.getTime() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    priority: 'success',
    category: 'buyer'
    username: 'user_123'
    },
    {
    id: 2,
    type: 'credits_purchased',
    title: 'Credits Added',
    message: 'Successfully purchased 500 credits using Bitcoin payment.',
    created_at: new Date(currentTime.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    priority: 'success',
    category: 'buyer',
    username: 'user_123'
    },
    {
    id: 3,
    type: 'credits_approval',
    title: 'Payment Processing',
    message: 'Your credit purchase of 1000 credits is being processed. This may take up to 24 hours.',
    created_at: new Date(currentTime.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    priority: 'info',
    category: 'buyer',
    username: 'user_123'
    },
    {
    id: 4,
    type: 'report_submitted',
    title: 'Report Submitted',
    message: 'Your report for "Steam Game Code" has been submitted and is under review.',
    created_at: new Date(currentTime.getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    priority: 'warning',
    category: 'buyer',
    username: 'user_123'
    },
    // Key Seller Notifications
    {
    id: 5,
    type: 'key_sold',
    title: 'Key Sold!',
    message: 'Your "Archive Password" was purchased by user_42 for 75 credits.',
    created_at: new Date(currentTime.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    priority: 'success',
    category: 'seller',
    username: 'seller_123'
    },
    {
    id: 6,
    type: 'key_reported',
    title: 'Key Reported',
    message: 'Your key "Game DLC Code" has been reported by a buyer. Please review.',
    created_at: new Date(currentTime.getTime() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    priority: 'warning',
    category: 'seller',
    username: 'seller_123'
    },
    {
    id: 7,
    type: 'redemption_status',
    title: 'Key Redemption Confirmed',
    message: 'The buyer has confirmed successful redemption of "Windows Pro License Key".',
    created_at: new Date(currentTime.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    priority: 'success',
    category: 'seller',
    username: 'seller_123'
    },
    {
    id: 8,
    type: 'credits_approved',
    title: 'Credits Approved',
    message: 'Your crypto payment has been confirmed. 1000 credits added to your account.',
    created_at: new Date(currentTime.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    priority: 'success',
    category: 'buyer',
    username: 'user_123'
    }
];

