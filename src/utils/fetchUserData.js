// creditUtils.js - Shared credit-related utility functions

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

/**
 * Refund credits to a user after a failed operation
 * @param {Object} params - Refund parameters
 * @param {string} params.userId - User ID
 * @param {string} params.username - Username
 * @param {string} params.email - User email
 * @param {number} params.credits - Amount to refund
 * @param {number} params.currentCredits - User's current credit balance
 * @param {string} params.password - User password
 * @param {Object} params.params - Operation parameters (optional)
 * @returns {Promise<Object>} Response data
 */
export async function fetchUserData({
  userId,
  username,
  email,
  credits,
  currentCredits,
  password,
  params = null
}) {
  try {

     const [userData, setUserData] = useState({
        "id": 1,
        "loginStatus": true,
        "lastLogin": "2025-09-28T10:30:00.000Z",
        "accountType": "buyer",
        "username": "user_123",
        "email": "john.buyer@example.com",
        "firstName": "John",
        "lastName": "Smith",
        "phoneNumber": "+1-555-0123",
        "birthDate": "1990-05-15",
        "encryptionKey": "enc_key_abc123",
        "credits": 750,
        "reportCount": 1,
        "isBanned": false,
        "banReason": "",
        "banDate": null,
        "banDuration": null,
        "createdAt": 1693497600000,
        "updatedAt": 1727517000000,
        "passwordHash": "$2b$10$hashedpassword123",
        "twoFactorEnabled": false,
        "twoFactorSecret": "",
        "recoveryCodes": [],
        "profilePicture": "https://i.pravatar.cc/150?img=1",
        "bio": "Gaming enthusiast and software collector",
        "socialLinks": {
          "facebook": "",
          "twitter": "@johnsmith",
          "instagram": "",
          "linkedin": "",
          "website": ""
        }
      });

    const load = async () => {

        try {
            // Direct API call to JSON Server
            let response;

            // fetch data if no data fetched before or last fetch was over 1.5 minutes ago
            // let lastDataFetchTooOld = !localStorage.getItem('lastDataFetch') ||
            //     (Date.now() - parseInt(localStorage.getItem('lastDataFetch') || "0", 10) > 1.5 * 60 * 1000);


            response = await api.post(`api/user`, {
                username: userData.username,
                email: userData.email,
                password: localStorage.getItem('passwordtxt')
            });

            // if (response.status === 200 && response.data) {
            console.log("API user response:", response);
            response.ok && console.log("API user response OK");
            if (response.data && response.data.success) {
                console.log("User profile response data:", response.data);
                // localStorage.setItem('Earnings', JSON.stringify(response.data.earnings || []));
                // localStorage.setItem('Unlocks', JSON.stringify(response.data.unlocks || []));
                localStorage.setItem('userdata', JSON.stringify(response.data.user || {}));
                localStorage.setItem('lastDataFetch', Date.now().toString()); // Set account type

                // Store dayPass data properly (don't store null as string)
                if (response.data.dayPassExpiry) {
                    localStorage.setItem('dayPassExpiry', response.data.dayPassExpiry);
                } else {
                    localStorage.removeItem('dayPassExpiry');
                }

                if (response.data.dayPassMode && new Date(response.data.dayPassExpiry) > new Date()) {
                    localStorage.setItem('dayPassMode', response.data.dayPassMode);
                } else {
                    localStorage.setItem('dayPassMode', 'free');
                }

                setDayPassExpiry(response.data.dayPassExpiry || null);
                setDayPassMode(response.data.dayPassMode || 'free');
                setBalance(response.data.user.credits || 0); // Use credits from userData or fallback
                setAccountType(response.data.user.accountType || 'free');
            } else {
                throw new Error('Failed to fetch wallet data');
            }

        } catch (e) {
            console.error('Error loading wallet balance:', e);
            setBalance(750); // demo fallback with realistic amount
            // clear local storage
            localStorage.clear();
            navigate('/info');
            setTimeout(() => { navigate('/login'); }, 15000); // Redirect to login after 15 seconds
        }

    };

    load();

  } catch (err) {

    console.error("Get User Data request error:", err);
    return {
      success: false,
      message: 'Unable to fetch user data. Please login again.',
      error: err
    };
  }


  try {
    const response = await fetch(`${API_URL}/api/refund-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        username,
        email,
        password: password || localStorage.getItem('passwordtxt'),
        credits,
        currentCredits,
        params
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`Refund of ${credits} successful:`, data);
      return {
        success: true,
        message: `Refunded ${credits} credits successfully.`,
        data
      };
    } else {
      console.error("Refund failed:", data);
      return {
        success: false,
        message: data.message || 'Refund failed. Please contact support.',
        data
      };
    }
  } catch (err) {
    console.error("Refund request error:", err);
    return {
      success: false,
      message: 'Unable to process refund. Please contact support.',
      error: err
    };
  }
}

