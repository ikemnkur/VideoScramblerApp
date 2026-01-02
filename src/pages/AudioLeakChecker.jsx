// AudioLeakChecker.jsx - Steganography-based leak detection for audios
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, TextField, Typography, Card, CardContent, Button, Box, Grid, Paper, Alert, CircularProgress, Chip, List, ListItem, ListItemText } from '@mui/material';
import { Speaker, Search, CheckCircle, Warning, Upload, Person, Movie } from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AudioLeakChecker() {

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';

  const { success, error: showError, info } = useToast();
  
  // Original and leaked audio files
  const [originalAudioFile, setOriginalAudioFile] = useState(null);
  const [leakedAudioFile, setLeakedAudioFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [leakedPreviewUrl, setLeakedPreviewUrl] = useState(null);
  
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState('idle');
  const [leakData, setLeakData] = useState(null);
  const [extractedCode, setExtractedCode] = useState('');
  
  const originalAudioFileInputRef = useRef(null);
  const leakedAudioFileInputRef = useRef(null);
  const keyFileInputRef = useRef(null);

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [allowLeakChecking, setAllowLeakChecking] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [actionCost, setActionCost] = useState(5);
  const [loadedKeyData, setLoadedKeyData] = useState(null);
  const [keyCode, setKeyCode] = useState('');

  const timeout = 1500; // 1.5 seconds

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
      const encryptionKey = "AudioProtectionKey2025";
      const jsonStr = xorEncrypt(encrypted, encryptionKey);
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('Decryption error:', err);
      throw new Error('Invalid or corrupted key file');
    }
  };

  const handleKeyFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const keyData = decryptKeyData(text);
      setLoadedKeyData(keyData);
      success('🔑 Key loaded!');
    } catch (err) {
      console.error("Error loading key:", err);
      showError('Invalid or corrupted key file');
    }
  };

  const handleOriginalFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('audio/')) {
      showError("Please select a valid audio file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showError("File size must be less than 50MB");
      return;
    }

    setOriginalAudioFile(file);
    const objectUrl = URL.createObjectURL(file);
    setOriginalPreviewUrl(objectUrl);
    success(`Original audio selected: ${file.name}`);
  };

  const handleLeakedFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('audio/')) {
      showError("Please select a valid audio file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showError("File size must be less than 50MB");
      return;
    }

    setLeakedAudioFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLeakedPreviewUrl(objectUrl);
    setCheckStatus('idle');
    setLeakData(null);
    success(`Leaked audio selected: ${file.name}`);
  };

  const handleCreditConfirm = useCallback(() => {
    setShowCreditModal(false);

    setAllowLeakChecking(true);

    handleCheckForLeak();

  }, []);

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
  }, []);

  const handleCheckForLeak = async () => {
    if (!originalAudioFile || !leakedAudioFile) {
      showError("Please select both original and leaked audio files");
      return;
    }

    if (!allowLeakChecking) {
      showError('You need to confirm credit usage before checking for leaks.');
      return;
    }

    setIsChecking(true);
    setCheckStatus('checking');

    try {
      const formData = new FormData();
      formData.append('originalAudio', originalAudioFile);
      formData.append('leakedAudio', leakedAudioFile);
      
      // Add key data if available
      if (loadedKeyData) {
        formData.append('keyData', JSON.stringify(loadedKeyData));
      } else if (keyCode) {
        formData.append('keyCode', keyCode);
      }

      const response = await fetch(`${API_URL}/api/check-audio-leak`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Leak check failed');

      if (data.leakDetected) {
        setCheckStatus('found');
        setLeakData(data.leakData);
        setExtractedCode(data.extractedCode);
        showError(`🚨 LEAK DETECTED! Code: ${data.extractedCode}`);
      } else {
        setCheckStatus('not-found');
        setExtractedCode(data.extractedCode || 'No code found');
        success('✅ No leak detected. This audio is clean.');
      }

      // Show credit spent message
      setTimeout(() => {
        info(`Audio checked successfully. ${data.creditsUsed || actionCost} credits spent.`);
      }, 1500);

    } catch (err) {
      setCheckStatus('error');
      showError(`Failed to check audio: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleReset = () => {
    setOriginalAudioFile(null);
    setLeakedAudioFile(null);
    setOriginalPreviewUrl(null);
    setLeakedPreviewUrl(null);
    setCheckStatus('idle');
    setLeakData(null);
    setExtractedCode('');
    setLoadedKeyData(null);
    setKeyCode('');
    if (originalAudioFileInputRef.current) originalAudioFileInputRef.current.value = '';
    if (leakedAudioFileInputRef.current) leakedAudioFileInputRef.current.value = '';
    if (keyFileInputRef.current) keyFileInputRef.current.value = '';
  };

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Search /> 🔊 Audio Leak Checker
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Detect hidden steganographic codes to track leaked audio content
        </Typography>
        {/* <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Steganography Detection" size="small" color="primary" />
          <Chip label="Max Size: 50MB" size="small" />
          <Chip label={`Status: ${checkStatus.toUpperCase()}`} size="small" color={checkStatus === 'found' ? 'error' : checkStatus === 'not-found' ? 'success' : checkStatus === 'checking' ? 'warning' : 'default'} />
        </Box> */}
      </Box>

      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd', mb: 2 }}>
        <Typography variant="body2" color="black">
          💡 <strong>How it works:</strong> Each scrambled audio contains hidden steganographic codes in its frames that uniquely identify the buyer. If the content is leaked, this system can extract the code and trace it back to the original purchaser.
        </Typography>
      </Paper>


      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Speaker /> Upload Audio Files for Leak Detection
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Original Audio File */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ color: '#4caf50', mb: 2 }}>
                  Original Audio File
                </Typography>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 2 }}>
                  Upload the original unscrambled audio file
                </Typography>

                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleOriginalFileSelect} 
                  style={{ display: 'none' }} 
                  id="original-audio-upload" 
                  ref={originalAudioFileInputRef} 
                />
                <label htmlFor="original-audio-upload">
                  <Button 
                    variant="contained" 
                    component="span" 
                    startIcon={<Upload />} 
                    sx={{ backgroundColor: '#4caf50', color: 'white', mb: 2 }}
                  >
                    Choose Original Audio
                  </Button>
                </label>

                {originalAudioFile && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#4caf50', mb: 1 }}>
                      ✓ Selected: {originalAudioFile.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                      Size: {(originalAudioFile.size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Leaked/Suspected Audio File */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, backgroundColor: '#353535', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ color: '#ff9800', mb: 2 }}>
                  Leaked/Suspected Audio File
                </Typography>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 2 }}>
                  Upload the audio file you want to check for leaks
                </Typography>

                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleLeakedFileSelect} 
                  style={{ display: 'none' }} 
                  id="leaked-audio-upload" 
                  ref={leakedAudioFileInputRef} 
                />
                <label htmlFor="leaked-audio-upload">
                  <Button 
                    variant="contained" 
                    component="span" 
                    startIcon={<Upload />} 
                    sx={{ backgroundColor: '#ff9800', color: 'white', mb: 2 }}
                  >
                    Choose Leaked Audio
                  </Button>
                </label>

                {leakedAudioFile && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#ff9800', mb: 1 }}>
                      ✓ Selected: {leakedAudioFile.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                      Size: {(leakedAudioFile.size / (1024 * 1024)).toFixed(2)} MB
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
              disabled={!originalAudioFile || !leakedAudioFile || isChecking}
              sx={{ 
                backgroundColor: (!originalAudioFile || !leakedAudioFile || isChecking) ? '#666' : '#22d3ee', 
                color: (!originalAudioFile || !leakedAudioFile || isChecking) ? '#999' : '#001018', 
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

          {/* Audio Previews */}
          {(originalPreviewUrl || leakedPreviewUrl) && (
            <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>Audio Previews</Typography>
              
              <Grid container spacing={3}>
                {/* Original Audio Preview */}
                {originalPreviewUrl && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, backgroundColor: '#2a2a2a', borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ color: '#4caf50', mb: 1 }}>
                        Original Audio
                      </Typography>
                      <audio 
                        controls 
                        style={{ width: '100%', borderRadius: '8px' }}
                        src={originalPreviewUrl}
                      >
                        Your browser does not support the audio tag.
                      </audio>
                    </Box>
                  </Grid>
                )}

                {/* Leaked Audio Preview */}
                {leakedPreviewUrl && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, backgroundColor: '#2a2a2a', borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ color: '#ff9800', mb: 1 }}>
                        Leaked/Suspected Audio
                      </Typography>
                      <audio 
                        controls 
                        style={{ width: '100%', borderRadius: '8px' }}
                        src={leakedPreviewUrl}
                      >
                        Your browser does not support the audio tag.
                      </audio>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}



          {checkStatus === 'checking' && <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2 }}><strong>Analyzing audio...</strong> Extracting hidden code from audio frames. This may take a moment.</Alert>}
          {checkStatus === 'error' && <Alert severity="error" sx={{ mb: 2 }}><strong>Error occurred during leak check</strong></Alert>}
          {checkStatus === 'not-found' && <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}><strong>Clean Audio ✅</strong> No leak detected. {extractedCode && extractedCode !== 'No code found' && <Box sx={{ mt: 1 }}>Extracted code: <code>{extractedCode}</code> (not in database)</Box>}</Alert>}
        </CardContent>
      </Card>

      {checkStatus === 'found' && leakData && (
        <Card elevation={3} sx={{ backgroundColor: '#d32f2f', color: 'white', mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><Warning /> �� LEAK DETECTED</Typography>
            <Alert severity="error" sx={{ mb: 3, backgroundColor: '#fff', color: '#000' }}>
              <strong>This audio contains a tracked watermark code!</strong> The content has been leaked or shared without authorization.
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
                    <ListItem><ListItemText primary="Media Type" secondary={leakData.media_type || 'audio'} /></ListItem>
                    <ListItem><ListItemText primary="Created At" secondary={leakData.created_at ? new Date(leakData.created_at).toLocaleString() : 'Unknown'} /></ListItem>
                    {leakData.device_fingerprint && <ListItem><ListItemText primary="Device Fingerprint" secondary={leakData.device_fingerprint} secondaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }} /></ListItem>}
                  </List>
                </Paper>
              </Grid>
            </Grid>
            <Typography variant="body2" sx={{ color: '#ffebee', mt: 3 }}>
              ⚠️ <strong>Action Required:</strong> This content was distributed with a unique watermark code embedded in the audio frames. The original owner can be contacted for copyright enforcement.
            </Typography>
          </CardContent>
        </Card>
      )}


      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#fff3e0' }}>
        <Typography variant="body2" color="black">
          ⚡ <strong>Note:</strong> Audio processing may take longer depending on file size and length. The system analyzes audio frames to extract hidden watermark codes. Leak detections are only available for media made with the premium version.
        </Typography>
      </Paper>

      {/* Credit Confirmation Modal */}
      <CreditConfirmationModal
        open={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onConfirm={handleCreditConfirm}
        mediaType="audio"
        currentCredits={userCredits}
        fileName={`${originalAudioFile?.name || ''} vs ${leakedAudioFile?.name || ''}`}
        file={leakedAudioFile}
        user={userData}
        isProcessing={false}
        fileDetails={{
          type: 'audio-leak-check',
          size: (originalAudioFile?.size || 0) + (leakedAudioFile?.size || 0),
          name: 'Audio Leak Detection',
          originalFile: originalAudioFile?.name || '',
          leakedFile: leakedAudioFile?.name || ''
        }}
        actionType="audio-leak-check"
        actionDescription="audio leak detection"
      />
    </Container>
  );
}
