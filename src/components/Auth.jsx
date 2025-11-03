// src/components/Auth.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  Box,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink } from 'react-router-dom';
import SimpleDotCaptcha from './SimpleDotCaptcha';
import CoinAnimationCanvas from '../components/CoinAnimationCanvas';

const Auth = ({ isLogin, onLoginSuccess }) => {
  // State variables
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [birthday, setBirthday] = useState('');
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const [blockTime, setBlockTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [accountType, setAccountType] = useState('buyer'); // New state for account type

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

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

  // Load user profile from server
  const loadUserProfile = async () => {
    try {
      const userdata = localStorage.getItem('userdata');
      if (!userdata) {
        throw new Error('No user data found');
      }

      const userData = JSON.parse(userdata);

      // Fetch latest user data from JSON server
      const response = await api.get(`/api/userData/${userData.id}`);

      if (response.status !== 200) {
        throw new Error('Failed to fetch user profile');
      }

      const profile = response.data;
      const updatedUserData = {
        ...profile,
        birthDate: profile.birthDate ? profile.birthDate.split('T')[0] : '',
      };

      setUserData(updatedUserData);
      localStorage.setItem('userdata', JSON.stringify(updatedUserData));
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // If error fetching profile, user might need to login again
      if (error.message.includes('No user data found')) {
        navigate('/login');
      }
    }
  };

  // Function to check block status
  const checkBlockStatus = useCallback(() => {
    const blockData = localStorage.getItem('captchaBlock');
    if (blockData) {
      const { timestamp } = JSON.parse(blockData);
      const currentTime = Date.now();
      if (currentTime - timestamp < 30 * 60 * 1000) { // 0.5 hour
        setBlockTime(timestamp + 30 * 60 * 1000);
      } else {
        localStorage.removeItem('captchaBlock');
      }
    }
  }, []);

  // Function to handle unblocking
  const handleUnblock = useCallback(() => {
    setBlockTime(null);
    setRemainingTime(null);
    localStorage.removeItem('captchaBlock');
    localStorage.removeItem('failedCaptcha'); // Reset failed attempts
  }, []);

  // Check if user is blocked on mount
  useEffect(() => {
    checkBlockStatus();
  }, [checkBlockStatus]);

  // Set up a timer to unblock the user after blockTime and update remaining time
  useEffect(() => {
    if (blockTime) {
      const updateRemainingTime = () => {
        const remaining = Math.max(0, Math.ceil((blockTime - Date.now()) / 1000));
        setRemainingTime(remaining);
      };

      updateRemainingTime(); // Initial call to set the remaining time
      const timer = setInterval(() => {
        updateRemainingTime();
        const currentTime = Date.now();
        if (currentTime >= blockTime) {
          handleUnblock();
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [blockTime, handleUnblock]);

  // New useEffect to check if user is already logged in and validate the token
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userdata = localStorage.getItem('userdata');

    if (token && userdata) {
      try {
        // Simple token validation - check if it's a demo token
        if (token.startsWith('demo_token_')) {
          const userData = JSON.parse(userdata);
          console.log('Valid token found for user:', userData.username);
          // Token is valid, redirect to main page
          navigate('/');
        } else {
          // Invalid token format, remove it
          localStorage.removeItem('token');
          localStorage.removeItem('userdata');
          localStorage.removeItem('accountType');
        }
      } catch (error) {
        // Error parsing user data, remove invalid data
        localStorage.removeItem('token');
        localStorage.removeItem('userdata');
        localStorage.removeItem('accountType');
      }
    }
  }, [navigate]);

  // Handler for successful CAPTCHA
  const handleCaptchaSuccess = useCallback(async () => {
    console.log('🎉 CAPTCHA completed successfully!');
    setCaptchaPassed(true);
    setCaptchaFailed(false);

    // Proceed to submit the authentication request after CAPTCHA is passed
    try {
      console.log('🚀 Starting authentication process...');
      if (isLogin) {
        console.log('📝 Processing login for email:', email);
        
        // Use the authentication endpoint we set up in the server
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: email, // Using email as username for login
            password: password 
          })
        });

        localStorage.setItem('passwordtxt', password); // Mark CAPTCHA as passed for this session

        if (!loginResponse.ok) {
          const errorData = await loginResponse.json();
          throw new Error(errorData.message || 'Login failed');
        }

        const loginData = await loginResponse.json();
        console.log('✅ Login response from server:', loginData);

        if (!loginData.success) {
          throw new Error(loginData.message || 'Login failed');
        }

        // Store user data and token from server response
        const { user, token } = loginData;
        localStorage.setItem('token', token);
        localStorage.setItem('userdata', JSON.stringify(user));
        localStorage.setItem('accountType', user.accountType);
        localStorage.setItem('unlockedKeys', JSON.stringify([])); // Initialize unlocked keys storage

        console.log('✅ Login successful for:', user.username);

        // Clear failed CAPTCHA attempts on success
        localStorage.removeItem('failedCaptcha');

      } else {
        console.log('📝 Processing registration for username:', username);
        
        // Use the registration endpoint we set up in the server
        const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            username: username,
            email: email,
            password: password,
            firstName: name.split(' ')[0] || name,
            lastName: name.split(' ').slice(1).join(' ') || '',
            accountType: accountType || 'buyer',
            birthDate: birthday
          })
        });

        if (!registerResponse.ok) {
          const errorData = await registerResponse.json();
          throw new Error(errorData.message || 'Registration failed');
        }

        const registerData = await registerResponse.json();
        console.log('✅ Registration response from server:', registerData);

        if (!registerData.success) {
          throw new Error(registerData.message || 'Registration failed');
        }

        // Store user data and token from server response
        const { user, token } = registerData;
        localStorage.setItem('token', token);
        localStorage.setItem('userdata', JSON.stringify(user));
        localStorage.setItem('accountType', user.accountType);
        localStorage.setItem('unlockedKeys', JSON.stringify([])); // Initialize unlocked keys storage

        console.log('✅ Registration successful for:', user.username);
      }

      // Clear failed CAPTCHA attempts on success
      localStorage.removeItem('failedCaptcha');

      console.log('🎯 Calling onLoginSuccess callback...');
      if (onLoginSuccess) {
        onLoginSuccess();
      }

      // Always navigate to main page after successful auth
      console.log('🧭 Navigating to /dashboard page...');
      setTimeout(() => {
        navigate('/');
      }, 500);

    } catch (error) {
      console.error('Auth error:', error.message || 'An error occurred');
      alert(error.message || 'An error occurred during authentication.');
      // Reset CAPTCHA state to allow the user to try again
      setCaptchaPassed(false);
      setShowCaptcha(false);
    }
  }, [email, password, username, name, birthday, accountType, isLogin, navigate, onLoginSuccess]);

  // Handler for failed CAPTCHA
  const handleCaptchaFailure = useCallback(() => {
    const failedAttempts = parseInt(localStorage.getItem('failedCaptcha') || '0', 10) + 1;
    localStorage.setItem('failedCaptcha', failedAttempts);
    if (failedAttempts >= 3) {
      localStorage.setItem('captchaBlock', JSON.stringify({ timestamp: Date.now() }));
      setBlockTime(Date.now() + 60 * 60 * 1000); // Block for 1 hour
      setCaptchaFailed(true);
    }
  }, []);

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // If CAPTCHA has not been shown yet
    if (!showCaptcha) {
      // Check if required fields are filled
      if (email.includes('@') === false || email.includes('.') === false || email.indexOf('.') < email.indexOf('@') || email.startsWith('@') || email.endsWith('@') || email.startsWith('.') || email.endsWith('.')) {
        alert('Please enter a valid email address.');
        return;
      }
      if (isLogin) {
        if (!email || !password) {
          alert('Please enter your email and password.');
          return;
        }
      } else {
        if (!username || !email || !password || !confirmPassword || !name || !country || !city || !birthday) {
          alert('Please fill in all required fields.');
          return;
        }
        if (password !== confirmPassword) {
          alert('Passwords do not match.');
          return;
        }
      }
      // Show CAPTCHA
      setShowCaptcha(true);
      return;
    }

    // If CAPTCHA is shown but not passed
    if (showCaptcha && !captchaPassed) {
      alert('Please complete the CAPTCHA correctly before submitting.');
      return;
    }
  };

  if (blockTime) {
    const remaining = remainingTime !== null
      ? remainingTime
      : Math.max(0, Math.ceil((blockTime - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mt: 8
        }}
      >
        <Card sx={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: 2 }}>
          <CardContent>
            <Typography variant="h6" color="error">
              Too many failed attempts.
            </Typography>
            <Typography variant="body1">
              Please try again in {minutes} minute{minutes !== 1 ? 's' : ''} and {seconds} second{seconds !== 1 ? 's' : ''}.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        mt: 2
      }}
    >


      {/* /* Add your coin animation just under the avatar, for example */}
      <Box sx={{ mb: 2 }}>
        <CoinAnimationCanvas />
      </Box>


      <Card sx={{ maxWidth: 400, width: '100%', background: '#1f201aff' }} elevation={0}>
        {/* <Avatar sx={{ m: 1, margin: "10px auto", textAlign: 'center', bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar> */}
        <CardHeader
          title={isLogin ? 'Login' : 'Sign Up'}
          sx={{ textAlign: 'center' }}
        />
        <CardContent>

          {!showCaptcha && (
            <>
              <form onSubmit={handleSubmit}>
                {!isLogin && (
                  <div>


                    Chose your account type:
                    {/* <FormControl fullWidth margin="normal" style={{ background: '#161616' }}>
                      <InputLabel>Account Type</InputLabel>
                      <Select 
                      style={{ background: '#161616' }}
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value)}
                        required
                        
                      >
                        <MenuItem style={{ background: '#161616' }} value="buyer">buyer/Supporter</MenuItem>
                        <MenuItem style={{ background: '#161616' }} value="seller">Creator/Receiver</MenuItem>
                      </Select>
                    </FormControl> */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, my: 2 }}>
                      <Button
                        variant={accountType === 'buyer' ? 'contained' : 'outlined'}
                        color={accountType === 'buyer' ? 'primary' : 'inherit'}
                        onClick={() => setAccountType('buyer')}
                        sx={{
                          flex: 1,
                          py: 2,
                          borderRadius: 2,
                          boxShadow: accountType === 'buyer' ? 2 : 0,
                          background: accountType === 'buyer' ? '#1976d2' : '#161616',
                          color: accountType === 'buyer' ? '#fff' : '#ccc',
                          fontWeight: 'bold',
                          fontSize: '1rem'
                        }}
                      >
                        Buyer
                      </Button>
                      <Button
                        variant={accountType === 'seller' ? 'contained' : 'outlined'}
                        color={accountType === 'seller' ? 'primary' : 'inherit'}
                        onClick={() => setAccountType('seller')}
                        sx={{
                          flex: 1,
                          py: 2,
                          borderRadius: 2,
                          boxShadow: accountType === 'seller' ? 2 : 0,
                          background: accountType === 'seller' ? '#1976d2' : '#161616',
                          color: accountType === 'seller' ? '#fff' : '#ccc',
                          fontWeight: 'bold',
                          fontSize: '1rem'
                        }}
                      >
                        Vendor/Seller
                      </Button>
                    </Box>

                    <TextField
                      label="Username"
                      variant="outlined"
                      fullWidth
                      margin="normal"
                      value={username}
                      onChange={(e) => {
                        if (e.target.value.length <= 24) {
                          setUsername(e.target.value);
                        }
                      }}
                      required
                      inputProps={{ maxLength: 24 }}
                      helperText={username.length === 24 ? "Maximum 24 characters allowed" : ""}
                    />
                  </div>
                )}
                {!isLogin && (
                  <TextField
                    label="Name"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                )}
                {!isLogin && (
                  <TextField
                    label="Country"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                  />
                )}
                {!isLogin && (
                  <TextField
                    label="City"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                )}
                {!isLogin && (
                  <TextField
                    label="Birthday"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    required
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                )}
                <TextField
                  label="Email"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <TextField
                  label="Password"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {!isLogin && (
                  <TextField
                    label="Confirm Password"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                )}
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  {isLogin ? 'Login' : 'Sign Up'}
                </Button>
              </form>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                {isLogin ? (
                  <Link component={RouterLink} to="/register">
                    Don't have an account? Sign Up
                  </Link>
                ) : (
                  <Link component={RouterLink} to="/login">
                    Already have an account? Login
                  </Link>
                )}
              </Box>
            </>
          )}

          {/* Show CAPTCHA only after submit is clicked and showCaptcha is true */}
          {showCaptcha && !captchaPassed && (
            <Box sx={{ mt: 2 }}>
              <SimpleDotCaptcha
                onPass={handleCaptchaSuccess}
                onFail={handleCaptchaFailure}
              />
            </Box>
          )}
          {captchaFailed && (
            <Typography variant="body2" color="error" align="center" sx={{ mt: 2 }}>
              You have been blocked due to multiple failed CAPTCHA attempts. Please try again later.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>


  );
};

export default Auth;
