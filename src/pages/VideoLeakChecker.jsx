// VideoLeakChecker.jsx - Steganography-based leak detection for videos
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Typography, Card, CardContent, Button, Box, Grid, Paper, Alert, CircularProgress, Chip, List, ListItem, ListItemText, Divider, TextField } from '@mui/material';
import { Videocam, Search, CheckCircle, Warning, Upload, Person, Movie, VpnKey } from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';

import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function VideoLeakChecker() {

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';

  const { success, error, info } = useToast();

  // Original and leaked video files
  const [originalVideoFile, setOriginalVideoFile] = useState(null);
  const [leakedVideoFile, setLeakedVideoFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [leakedPreviewUrl, setLeakedPreviewUrl] = useState(null);
  
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState('idle');
  const [leakData, setLeakData] = useState(null);
  const [extractedCode, setExtractedCode] = useState('');
  
  const originalVideoFileInputRef = useRef(null);
  const leakedVideoFileInputRef = useRef(null);
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
      const encryptionKey = "VideoProtectionKey2025";
      const jsonStr = xorEncrypt(encrypted, encryptionKey);
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('Decryption error:', err);
      throw new Error('Invalid or corrupted key file');
    }
  };




  const handleOriginalFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      error("Please select a valid video file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      error("File size must be less than 50MB");
      return;
    }

    setOriginalVideoFile(file);
    setOriginalPreviewUrl(URL.createObjectURL(file));
    success(`Original video selected: ${file.name}`);
  };

  const handleLeakedFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      error("Please select a valid video file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      error("File size must be less than 50MB");
      return;
    }

    setLeakedVideoFile(file);
    setLeakedPreviewUrl(URL.createObjectURL(file));
    setCheckStatus('idle');
    setLeakData(null);
    success(`Leaked video selected: ${file.name}`);
  };

  const handleCreditConfirm = useCallback(() => {
    setShowCreditModal(false);

    setAllowLeakChecking(true);

    handleCheckForLeak();

  }, []);

  const handleKeyFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Try to decrypt the key file (if it's encrypted)
      try {
        const keyData = decryptKeyData(text);
        // Set the decoded parameters directly
        setDecodedParams(keyData);
        setKeyCode(text); // Store the encrypted key in the text box
        success('🔑 Key file loaded and decoded successfully!');
      } catch (decryptErr) {
        // If decryption fails, try to parse as plain JSON or base64
        try {
          // Check if it's base64 encoded
          const decoded = fromBase64(text.trim());
          const keyData = JSON.parse(decoded);
          setDecodedParams(keyData);
          setKeyCode(text.trim());
          console.log("Decoded key data from base64:", keyData);
          success('🔑 Key file loaded and decoded successfully!');
        } catch (base64Err) {
          // Try direct JSON parse
          const keyData = JSON.parse(text);
          setDecodedParams(keyData);
          setKeyCode(btoa(text)); // Convert to base64 for consistency
          success('🔑 Key file loaded and decoded successfully!');
        }
      }

      if (decodedParams.type == "video") {
        error('The loaded key file is not a valid video scramble key.');
      } else if (decodedParams.version !== "free") {
        error('Use the ' + decodedParams.version + ' ' + decodedParams.type + ' scrambler to unscramble this file.');
        alert('The loaded key file will not work with this scrambler version, you must use the ' + decodedParams.version + ' ' + decodedParams.type + ' scrambler to unscramble this file.');
      }
    } catch (err) {
      console.error("Error loading key:", err);
      error('Invalid or corrupted key file. Please check the file format.');
    }
  };

  useEffect(() => {
    const fetchUserCredits = async () => {
      try {
        const response = await api.post(`api/wallet/balance/${userData.username}`, {
          username: userData.username,
          email: userData.email,
          password: localStorage.getItem('passwordtxt')
        });

        if (response.status === 200 && response.data) {
          setUserCredits(response.data.credits);
        }
      } catch (err) {
        console.error('Failed to fetch user credits:', err);
      }
    };

    if (userData?.username) {
      fetchUserCredits();
    }
  }, [userData]);

  const handleCheckForLeak = async () => {
    if (!originalVideoFile || !leakedVideoFile) {
      error("Please select both original and leaked video files");
      return;
    }

    if (!allowLeakChecking) {
      error('You need to confirm credit usage before checking for leaks.');
      return;
    }

    setIsChecking(true);
    setCheckStatus('checking');

    try {
      const formData = new FormData();
      formData.append('originalVideo', originalVideoFile);
      formData.append('leakedVideo', leakedVideoFile);
      
      // Add key data if available
      if (loadedKeyData) {
        formData.append('keyData', JSON.stringify(loadedKeyData));
      } else if (keyCode) {
        formData.append('keyCode', keyCode);
      }

      const response = await fetch(`${API_URL}/api/check-video-leak`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Leak check failed');

      if (data.leakDetected) {
        setCheckStatus('found');
        setLeakData(data.leakData);
        setExtractedCode(data.extractedCode);
        error(`🚨 LEAK DETECTED! Code: ${data.extractedCode}`);
      } else {
        setCheckStatus('not-found');
        setExtractedCode(data.extractedCode || 'No code found');
        success('✅ No leak detected. This video is clean.');
      }

      // Show credit spent message
      setTimeout(() => {
        info(`Video checked successfully. ${data.creditsUsed || actionCost} credits spent.`);
      }, 1500);

    } catch (err) {
      setCheckStatus('error');
      error(`Failed to check video: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleReset = () => {
    setOriginalVideoFile(null);
    setLeakedVideoFile(null);
    setOriginalPreviewUrl(null);
    setLeakedPreviewUrl(null);
    setCheckStatus('idle');
    setLeakData(null);
    setExtractedCode('');
    setLoadedKeyData(null);
    setKeyCode('');
    if (originalVideoFileInputRef.current) originalVideoFileInputRef.current.value = '';
    if (leakedVideoFileInputRef.current) leakedVideoFileInputRef.current.value = '';
    if (keyFileInputRef.current) keyFileInputRef.current.value = '';
  };

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Search /> 🎥 Video Leak Checker
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Detect hidden steganographic codes to track leaked video content
        </Typography>
        {/* <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Steganography Detection" size="small" color="primary" />
          <Chip label="Max Size: 50MB" size="small" />
          <Chip label={`Status: ${checkStatus.toUpperCase()}`} size="small" color={checkStatus === 'found' ? 'error' : checkStatus === 'not-found' ? 'success' : checkStatus === 'checking' ? 'warning' : 'default'} />
        </Box> */}
      </Box>

      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd', mb: 2 }}>
        <Typography variant="body2" color="black">
          💡 <strong>How it works:</strong> Each scrambled video contains hidden steganographic codes in its frames that uniquely identify the buyer. If the content is leaked, this system can extract the code and trace it back to the original purchaser.
        </Typography>
      </Paper>


      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Videocam /> Upload Videos for Leak Detection
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Original Video File */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ color: '#4caf50', mb: 2 }}>
                  Original Video File
                </Typography>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 2 }}>
                  Upload the original unscrambled video file
                </Typography>

                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={handleOriginalFileSelect} 
                  style={{ display: 'none' }} 
                  id="original-video-upload" 
                  ref={originalVideoFileInputRef} 
                />
                <label htmlFor="original-video-upload">
                  <Button 
                    variant="contained" 
                    component="span" 
                    startIcon={<Upload />} 
                    sx={{ backgroundColor: '#4caf50', color: 'white', mb: 2 }}
                  >
                    Choose Original Video
                  </Button>
                </label>

                {originalVideoFile && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#4caf50', mb: 1 }}>
                      ✓ Selected: {originalVideoFile.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                      Size: {(originalVideoFile.size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Leaked/Suspected Video File */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ color: '#ff9800', mb: 2 }}>
                  Leaked/Suspected Video File
                </Typography>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 2 }}>
                  Upload the video file you want to check for leaks
                </Typography>

                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={handleLeakedFileSelect} 
                  style={{ display: 'none' }} 
                  id="leaked-video-upload" 
                  ref={leakedVideoFileInputRef} 
                />
                <label htmlFor="leaked-video-upload">
                  <Button 
                    variant="contained" 
                    component="span" 
                    startIcon={<Upload />} 
                    sx={{ backgroundColor: '#ff9800', color: 'white', mb: 2 }}
                  >
                    Choose Leaked Video
                  </Button>
                </label>

                {leakedVideoFile && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#ff9800', mb: 1 }}>
                      ✓ Selected: {leakedVideoFile.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                      Size: {(leakedVideoFile.size / (1024 * 1024)).toFixed(2)} MB
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
                <Typography variant="h6" sx={{ color: '#bdbdbd' }}>OR</Typography>
              </Grid>

              <Grid item xs={12} md={5}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Enter Key Code
                </Typography>
                <TextField
                  fullWidth
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value)}
                  placeholder="Enter key code..."
                  sx={{
                    '& .MuiInputBase-root': {
                      backgroundColor: '#1e1e1e',
                      color: 'white',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }
                  }}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 3, backgroundColor: '#666' }} />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button 
              variant="contained" 
              onClick={() => setShowCreditModal(true)} 
              startIcon={isChecking ? <CircularProgress size={20} color="inherit" /> : <Search />} 
              disabled={!originalVideoFile || !leakedVideoFile || isChecking}
              sx={{ 
                backgroundColor: (!originalVideoFile || !leakedVideoFile || isChecking) ? '#666' : '#22d3ee', 
                color: (!originalVideoFile || !leakedVideoFile || isChecking) ? '#999' : '#001018', 
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

          {/* Video Previews */}
          {(originalPreviewUrl || leakedPreviewUrl) && (
            <Box sx={{ borderTop: '1px solid #666', pt: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>Video Previews</Typography>
              <Grid container spacing={2}>
                {originalPreviewUrl && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ color: '#4caf50', mb: 1 }}>
                      Original Video
                    </Typography>
                    <Box sx={{ backgroundColor: '#0b1020', border: '1px solid #4caf50', borderRadius: '8px', padding: 2 }}>
                      <video 
                        ref={originalVideoRef} 
                        controls 
                        style={{ width: '100%', maxHeight: '300px', borderRadius: '8px' }}
                      >
                        <source src={originalPreviewUrl} type={originalVideoFile?.type} />
                        Your browser does not support the video tag.
                      </video>
                    </Box>
                  </Grid>
                )}
                {leakedPreviewUrl && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ color: '#ff9800', mb: 1 }}>
                      Leaked/Suspected Video
                    </Typography>
                    <Box sx={{ backgroundColor: '#0b1020', border: '1px solid #ff9800', borderRadius: '8px', padding: 2 }}>
                      <video 
                        ref={leakedVideoRef} 
                        controls 
                        style={{ width: '100%', maxHeight: '300px', borderRadius: '8px' }}
                      >
                        <source src={leakedPreviewUrl} type={leakedVideoFile?.type} />
                        Your browser does not support the video tag.
                      </video>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {checkStatus === 'checking' && <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2 }}><strong>Analyzing video...</strong> Extracting hidden code from video frames. This may take a moment.</Alert>}
          {checkStatus === 'error' && <Alert severity="error" sx={{ mb: 2 }}><strong>Error occurred during leak check</strong></Alert>}
          {checkStatus === 'not-found' && <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}><strong>Clean Video ✅</strong> No leak detected. {extractedCode && extractedCode !== 'No code found' && <Box sx={{ mt: 1 }}>Extracted code: <code>{extractedCode}</code> (not in database)</Box>}</Alert>}
        </CardContent>
      </Card>

      {checkStatus === 'found' && leakData && (
        <Card elevation={3} sx={{ backgroundColor: '#d32f2f', color: 'white', mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><Warning /> �� LEAK DETECTED</Typography>
            <Alert severity="error" sx={{ mb: 3, backgroundColor: '#fff', color: '#000' }}>
              <strong>This video contains a tracked watermark code!</strong> The content has been leaked or shared without authorization.
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
                  <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}><Movie /> File Information</Typography>
                  <List dense>
                    <ListItem><ListItemText primary="Original Filename" secondary={leakData.filename || 'Unknown'} /></ListItem>
                    <ListItem><ListItemText primary="Media Type" secondary={leakData.media_type || 'video'} /></ListItem>
                    <ListItem><ListItemText primary="Created At" secondary={leakData.created_at ? new Date(leakData.created_at).toLocaleString() : 'Unknown'} /></ListItem>
                    {leakData.device_fingerprint && <ListItem><ListItemText primary="Device Fingerprint" secondary={leakData.device_fingerprint} secondaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }} /></ListItem>}
                  </List>
                </Paper>
              </Grid>
            </Grid>
            <Typography variant="body2" sx={{ color: '#ffebee', mt: 3 }}>
              ⚠️ <strong>Action Required:</strong> This content was distributed with a unique watermark code embedded in the video frames. The original owner can be contacted for copyright enforcement.
            </Typography>
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
        mediaType="video"
        currentCredits={userCredits}
        fileName={`${originalVideoFile?.name || ''} vs ${leakedVideoFile?.name || ''}`}
        file={leakedVideoFile}
        user={userData}
        isProcessing={false}
        fileDetails={{
          type: 'video-leak-check',
          size: (originalVideoFile?.size || 0) + (leakedVideoFile?.size || 0),
          originalFile: originalVideoFile?.name || '',
          leakedFile: leakedVideoFile?.name || '',
          originalSize: originalVideoFile?.size || 0,
          leakedSize: leakedVideoFile?.size || 0
        }}
        actionType="video-leak-check"
        actionDescription="video leak detection"
      />
    </Container>
  );
}
