// PhotoLeakChecker.jsx - Steganography-based leak detection for photos
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Typography, Card, CardContent, Button, Box, Grid, Paper, Alert, CircularProgress, Chip, List, ListItem, ListItemText, TextField, Divider } from '@mui/material';
import { PhotoCamera, Search, CheckCircle, Warning, Upload, Fingerprint, Person, VpnKey } from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function PhotoLeakChecker() {

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';

  const { success, error, info } = useToast();

  // Original and leaked image files
  const [originalImageFile, setOriginalImageFile] = useState(null);
  const [leakedImageFile, setLeakedImageFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [leakedPreviewUrl, setLeakedPreviewUrl] = useState(null);

  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState('idle');
  const [leakData, setLeakData] = useState(null);
  const [extractedCode, setExtractedCode] = useState('');

  const originalImageFileInputRef = useRef(null);
  const leakedImageFileInputRef = useRef(null);
  const keyFileInputRef = useRef(null);

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [allowLeakChecking, setAllowLeakChecking] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [actionCost, setActionCost] = useState(10);
  const [loadedKeyData, setLoadedKeyData] = useState(null);
  const [keyCode, setKeyCode] = useState('');

  // XOR decryption function
  const xorEncrypt = (text, key) => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  };

  const decryptKeyData = (encodedData) => {
    try {
      const encrypted = atob(encodedData);
      const encryptionKey = "PhotoProtectionKey2025";
      const jsonStr = xorEncrypt(encrypted, encryptionKey);
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('Decryption error:', err);
      throw new Error('Invalid or corrupted key file');
    }
  };

  // Base64 encoding/decoding utilities
  const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const fromBase64 = (b64) => decodeURIComponent(escape(atob(b64.trim())));

  // Array conversion utilities
  const oneBased = (a) => a.map(x => x + 1);
  const zeroBased = (a) => a.map(x => x - 1);




  const handleOriginalFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      error("Please select a valid image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      error("File size must be less than 10MB");
      return;
    }

    setOriginalImageFile(file);
    setOriginalPreviewUrl(URL.createObjectURL(file));
    success(`Original image selected: ${file.name}`);
  };

  const handleLeakedFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      error("Please select a valid image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      error("File size must be less than 10MB");
      return;
    }

    setLeakedImageFile(file);
    setLeakedPreviewUrl(URL.createObjectURL(file));
    setCheckStatus('idle');
    setLeakData(null);
    success(`Leaked image selected: ${file.name}`);
  };





  const handleKeyFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      // const keyData = decryptKeyData(text);
      const decoded = fromBase64(text.trim());
      const keyData = JSON.parse(decoded);

      setLoadedKeyData(keyData);
      success('🔑 Key loaded!');
    } catch (err) {
      console.error("Error loading key:", err);
      error('Invalid or corrupted key file');
    }
  };



  const handleCreditConfirm = useCallback(() => {
    setShowCreditModal(false);

    setAllowLeakChecking(true);

    handleCheckForLeak();

  }, []);

  const handleCheckForLeak = async () => {
    if (!originalImageFile || !leakedImageFile) {
      console.log("Missing files:", originalImageFile);
      console.log("Missing files:", leakedImageFile);
      error("Please select both original and leaked image files");
      return;
    }

    // if (!allowLeakChecking) {
    //   error('You need to confirm credit usage before checking for leaks.');
    //   return;
    // }

    setIsChecking(true);
    setCheckStatus('checking');

    try {
      const formData = new FormData();
      formData.append('originalImage', originalImageFile); // Append original image file
      formData.append('leakedImage', leakedImageFile); // Append leaked image file

      // Add key data if available
      if (loadedKeyData) {
        formData.append('keyData', JSON.stringify(loadedKeyData));  // Append key data as JSON string
      } else if (keyCode) {
        formData.append('keyCode', keyCode);
      }

      const response = await api.post(`${API_URL}/api/check-photo-leak`, formData);
      const data = response.data;
      // if (!response.ok) throw new Error(data.error || 'Leak check failed');

      // if (data.leakDetected) {
      //   setCheckStatus('found');
      //   setLeakData(data.leakData);
      //   setExtractedCode(data.extractedCode);
      //   error(`🚨 LEAK DETECTED! Code: ${data.extractedCode}`);
      // } else {
      //   setCheckStatus('not-found');
      //   setExtractedCode(data.extractedCode || 'No code found');
      //   success('✅ No leak detected. This image is clean.');
      // }

      // Show credit spent message
      setTimeout(() => {
        info(`Image submitted, checks will complete shortly. ${data.creditsUsed || actionCost} credits spent.`);
      }, 1500);

    } catch (err) {
      setCheckStatus('error');
      error(`Failed to check image: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {

    async function fetchData() {
      try {
        // JWT token in the Authorization header automatically authenticates the user
        // No need to send password (it's not stored in localStorage anyway)
        const { data } = await api.post(`/api/wallet/balance/${userData.username}`, {
          email: userData.email
        });

      } catch (e) {
        console.error('Failed to load wallet balance:', e);

        // Handle authentication errors
        if (e.response?.status === 401 || e.response?.status === 403) {
          error('Session expired. Please log in again.');
          setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('userdata');
            window.location.href = '/login';
          }, 2000);
        } else {
          error('Failed to load balance. Please try again.');
        }
        setBalance(0);
      }

    }
    fetchData();
  }, []);

  const handleReset = () => {
    setOriginalImageFile(null);
    setLeakedImageFile(null);
    setOriginalPreviewUrl(null);
    setLeakedPreviewUrl(null);
    setCheckStatus('idle');
    setLeakData(null);
    setExtractedCode('');
    setLoadedKeyData(null);
    setKeyCode('');
    if (originalImageFileInputRef.current) originalImageFileInputRef.current.value = '';
    if (leakedImageFileInputRef.current) leakedImageFileInputRef.current.value = '';
    if (keyFileInputRef.current) keyFileInputRef.current.value = '';
  };

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Search /> 🔍 Photo Leak Checker
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          {/* Detect hidden steganographic codes to track leaked content */}
          Scan images to detect origins of leaks and figure out which device leaked it
        </Typography>
        {/* <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Steganography Detection" size="small" color="primary" />
          <Chip label="Max Size: 10MB" size="small" />
          <Chip label={`Status: ${checkStatus.toUpperCase()}`} size="small" color={checkStatus === 'found' ? 'error' : checkStatus === 'not-found' ? 'success' : checkStatus === 'checking' ? 'warning' : 'default'} />
        </Box> */}
      </Box>

      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd', mb: 2 }}>
        <Typography variant="body2" color="black">
          💡 <strong>How it works:</strong> Each scrambled photo contains a hidden steganographic code that uniquely identifies the buyer. If the content is leaked, this system can extract the code and trace it back to the original purchaser.
        </Typography>
      </Paper>

      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PhotoCamera /> Upload Images for Leak Detection
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Original Image File */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ color: '#4caf50', mb: 2 }}>
                  Original Image File
                </Typography>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 2 }}>
                  Upload the original unscrambled image file
                </Typography>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleOriginalFileSelect}
                  style={{ display: 'none' }}
                  id="original-image-upload"
                  ref={originalImageFileInputRef}
                />
                <label htmlFor="original-image-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<Upload />}
                    sx={{ backgroundColor: '#4caf50', color: 'white', mb: 2 }}
                  >
                    Choose Original Image
                  </Button>
                </label>

                {originalImageFile && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#4caf50', mb: 1 }}>
                      ✓ Selected: {originalImageFile.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                      Size: {(originalImageFile.size / 1024).toFixed(2)} KB
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Leaked/Suspected Image File */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ color: '#ff9800', mb: 2 }}>
                  Leaked/Suspected Image File
                </Typography>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 2 }}>
                  Upload the image file you want to check for leaks
                </Typography>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLeakedFileSelect}
                  style={{ display: 'none' }}
                  id="leaked-image-upload"
                  ref={leakedImageFileInputRef}
                />
                <label htmlFor="leaked-image-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<Upload />}
                    sx={{ backgroundColor: '#ff9800', color: 'white', mb: 2 }}
                  >
                    Choose Leaked Image
                  </Button>
                </label>

                {leakedImageFile && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#ff9800', mb: 1 }}>
                      ✓ Selected: {leakedImageFile.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                      Size: {(leakedImageFile.size / 1024).toFixed(2)} KB
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Optional Key File or Code */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 2 }}>
              Optional: Scramble Key (for enhanced detection)
            </Typography>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Upload Key File
                </Typography>
                <input
                  type="file"
                  accept=".key,.json,.txt"
                  onChange={handleKeyFileSelect}
                  style={{ display: 'none' }}
                  id="key-file-upload"
                  ref={keyFileInputRef}
                />
                <label htmlFor="key-file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<Upload />}
                    sx={{ borderColor: '#2196f3', color: '#2196f3' }}
                  >
                    Choose Key File
                  </Button>
                </label>
                {loadedKeyData && (
                  <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                    ✓ Key loaded
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} md={2} sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ color: '#666' }}>OR</Typography>
              </Grid>

              <Grid item xs={12} md={5}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Enter Key Code
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value)}
                  placeholder="Paste key code here..."
                  sx={{
                    '& .MuiInputBase-root': {
                      backgroundColor: '#2a2a2a',
                      color: 'white',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem'
                    }
                  }}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button
              variant="contained"
              onClick={() => setShowCreditModal(true)}
              startIcon={isChecking ? <CircularProgress size={20} color="inherit" /> : <Search />}
              disabled={!originalImageFile || !leakedImageFile || isChecking}
              sx={{
                backgroundColor: (!originalImageFile || !leakedImageFile || isChecking) ? '#666' : '#22d3ee',
                color: (!originalImageFile || !leakedImageFile || isChecking) ? '#999' : '#001018',
                fontWeight: 'bold',
                minWidth: 200
              }}
            >
              {isChecking ? 'Checking for Leaks...' : 'Check for Leak'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleReset}
              disabled={isChecking}
              sx={{ borderColor: '#666', color: '#e0e0e0' }}
            >
              Reset
            </Button>
          </Box>

          {/* Image Previews */}
          {(originalPreviewUrl || leakedPreviewUrl) && (
            <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>Image Previews</Typography>

              <Grid container spacing={3}>
                {/* Original Image Preview */}
                {originalPreviewUrl && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, backgroundColor: '#2a2a2a', borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ color: '#4caf50', mb: 1 }}>
                        Original Image
                      </Typography>
                      <Box sx={{ backgroundColor: '#0b1020', border: '1px dashed #666', borderRadius: '8px', p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img
                          src={originalPreviewUrl}
                          alt="Original Preview"
                          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                )}

                {/* Leaked Image Preview */}
                {leakedPreviewUrl && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, backgroundColor: '#2a2a2a', borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ color: '#ff9800', mb: 1 }}>
                        Leaked/Suspected Image
                      </Typography>
                      <Box sx={{ backgroundColor: '#0b1020', border: '1px dashed #666', borderRadius: '8px', p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img
                          src={leakedPreviewUrl}
                          alt="Leaked Preview"
                          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {checkStatus === 'checking' && <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2 }}><strong>Analyzing image...</strong> Extracting hidden code using steganography detection.</Alert>}
          {checkStatus === 'error' && <Alert severity="error" sx={{ mb: 2 }}><strong>Error occurred during leak check</strong></Alert>}
          {checkStatus === 'not-found' && <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}><strong>Clean Image ✅</strong> No leak detected. {extractedCode && extractedCode !== 'No code found' && <Box sx={{ mt: 1 }}>Extracted code: <code>{extractedCode}</code> (not in database)</Box>}</Alert>}
        </CardContent>
      </Card>

      {checkStatus === 'found' && leakData && (
        <Card elevation={3} sx={{ backgroundColor: '#d32f2f', color: 'white', mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><Warning /> �� LEAK DETECTED</Typography>
            <Alert severity="error" sx={{ mb: 3, backgroundColor: '#fff', color: '#000' }}>
              <strong>This image contains a tracked watermark code!</strong> The content has been leaked or shared without authorization.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: '#424242' }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Extracted Code</Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', backgroundColor: '#0b1020', p: 2, borderRadius: 1, wordBreak: 'break-all' }}>{extractedCode}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: '#424242' }}>
                  <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}><Person /> Original Owner</Typography>
                  <Typography variant="body1">User ID: {leakData.user_id || 'N/A'}</Typography>
                  <Typography variant="body2" sx={{ color: '#bdbdbd' }}>{leakData.username && `Username: ${leakData.username}`}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, backgroundColor: '#424242' }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>File Information</Typography>
                  <List dense>
                    <ListItem><ListItemText primary="Original Filename" secondary={leakData.filename || 'Unknown'} /></ListItem>
                    <ListItem><ListItemText primary="Media Type" secondary={leakData.media_type || 'image'} /></ListItem>
                    <ListItem><ListItemText primary="Created At" secondary={leakData.created_at ? new Date(leakData.created_at).toLocaleString() : 'Unknown'} /></ListItem>
                    {leakData.device_fingerprint && <ListItem><ListItemText primary="Device Fingerprint" secondary={leakData.device_fingerprint} secondaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }} /></ListItem>}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}


      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#fff3e0' }}>
        <Typography variant="body2" color="black">
          ⚡ <strong>Note:</strong> Video processing may take longer depending on file size and length. The system analyzes video frames to extract hidden watermark codes. Leak detections are only available for media made with the premium version.
        </Typography>
      </Paper>


      {/* Credit Confirmation Modal */}
      <CreditConfirmationModal
        open={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onConfirm={handleCreditConfirm}
        mediaType="photo"
        currentCredits={userCredits}
        fileName={`${originalImageFile?.name || ''} vs ${leakedImageFile?.name || ''}`}
        user={userData}
        isProcessing={false}
        file={leakedImageFile}
        fileDetails={{
          type: 'photo-leak-check',
          size: (originalImageFile?.size || 0) + (leakedImageFile?.size || 0),
          name: 'Photo Leak Detection',
          originalFile: originalImageFile?.name || '',
          leakedFile: leakedImageFile?.name || ''
        }}
        actionType="photo-leak-check"
        actionDescription="photo leak detection"
      />
    </Container>
  );
}
