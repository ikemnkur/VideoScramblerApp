// VideoLeakChecker.jsx - Steganography-based leak detection for videos
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Typography, Card, CardContent, Button, Box, Grid, Paper, Alert, CircularProgress, Chip, List, ListItem, ListItemText } from '@mui/material';
import { Videocam, Search, CheckCircle, Warning, Upload, Person, Movie } from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function VideoLeakChecker() {

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';

  const { success, error: showError } = useToast();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState('idle');
  const [leakData, setLeakData] = useState(null);
  const [extractedCode, setExtractedCode] = useState('');
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [allowLeakChecking, setAllowLeakChecking] = useState(false);
  const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
  const actionCost = 10; // Cost to scramble a photo (less than video)




  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      showError("Please select a valid video file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showError("File size must be less than 50MB");
      return;
    }
    setSelectedFile(file);
    console.log("Selected file:", file);
    setPreviewUrl(URL.createObjectURL(file));
    setCheckStatus('idle');
    setLeakData(null);
    success(`Selected: ${file.name}`);
  };

  const handleCreditConfirm = useCallback(() => {
    setShowCreditModal(false);

    setAllowLeakChecking(true);

    handleCheckForLeak();

  }, []);

  useEffect(async () => {
    let response = await api.post(`api/wallet/balance/${userData.username}`, {
      username: userData.username,
      email: userData.email,
      password: localStorage.getItem('passwordtxt')
    });

    if (response.status === 200 && response.data) {
      setUserCredits(response.data.credits);
    }
  }, []);

  const handleCheckForLeak = async () => {
    if (!selectedFile) {
      showError("Please select a video file first");
      return;
    }

    if (!allowLeakChecking) {
      error('You need to confirm credit usage before applying parameters.');
      return;
    }

    setIsChecking(true);
    setCheckStatus('checking');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
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
        showError(`🚨 LEAK DETECTED! Code: ${data.extractedCode}`);
      } else {
        setCheckStatus('not-found');
        setExtractedCode(data.extractedCode || 'No code found');
        success('✅ No leak detected. This video is clean.');
      }

      // SHOW MESSAGE DIALOG SAYTHING THAT THE USER HAS SPENT CREDITS TO CHECK THE IMAGE
      try {
        setTimeout(() => {
          info(`Image checked successfully. ${data.creditsUsed} credits spent.`);
        }, timeout);
      } catch (error) {
        console.error('Error showing credit spent info:', error);
      }

    } catch (err) {
      setCheckStatus('error');
      showError(`Failed to check video: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCheckStatus('idle');
    setLeakData(null);
    setExtractedCode('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <Videocam /> Upload Video for Leak Detection
          </Typography>

          <Box sx={{ mb: 3 }}>
            <input type="file" accept="video/*" onChange={handleFileSelect} style={{ display: 'none' }} id="video-leak-upload" ref={fileInputRef} />
            <label htmlFor="video-leak-upload">
              <Button variant="contained" component="span" startIcon={<Upload />} sx={{ backgroundColor: '#2196f3', color: 'white', mb: 2 }}>
                Choose Video File
              </Button>
            </label>
            {selectedFile && (
              <Box>
                <Typography variant="body2" sx={{ color: '#4caf50', mb: 1 }}>✓ Selected: {selectedFile.name}</Typography>
                <Typography variant="caption" sx={{ color: '#bdbdbd' }}>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB | Type: {selectedFile.type}</Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button variant="contained" onClick={() => setShowCreditModal(true)} startIcon={isChecking ? <CircularProgress size={20} color="inherit" /> : <Search />} disabled={!selectedFile || isChecking}
              sx={{ backgroundColor: (!selectedFile || isChecking) ? '#666' : '#22d3ee', color: (!selectedFile || isChecking) ? '#999' : '#001018', fontWeight: 'bold', minWidth: 200 }}>
              {isChecking ? 'Checking for Leaks...' : 'Check for Leak'}
            </Button>
            <Button variant="outlined" onClick={handleReset} disabled={isChecking} sx={{ borderColor: '#666', color: '#e0e0e0' }}>Reset</Button>
          </Box>

          {previewUrl && (
            <Box sx={{ borderTop: '1px solid #666', pt: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>Video Preview</Typography>
              <Box sx={{ backgroundColor: '#0b1020', border: '1px dashed #666', borderRadius: '8px', padding: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video ref={videoRef} controls style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px' }}>
                  <source src={previewUrl} type={selectedFile?.type} />
                  Your browser does not support the video tag.
                </video>
              </Box>
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
        creditCost={actionCost}
        currentCredits={userCredits}
        fileName={selectedFile?.name || ''}
        file={selectedFile}
        user={userData}
        isProcessing={false}
        fileDetails={{
          type: 'video',
          size: selectedFile?.size || 0,
          name: selectedFile?.name || '',
          duration: videoRef.current?.duration || 0,
          horizontal: videoRef.current?.videoWidth || 0,
          vertical: videoRef.current?.videoHeight || 0
        }}


        actionType="video-leak-check"
        actionDescription="video leak detection"
      />
    </Container>
  );
}
