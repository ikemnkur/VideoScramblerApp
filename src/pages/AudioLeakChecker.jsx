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

  const { success, error: showError } = useToast();
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState('idle');
  const [leakData, setLeakData] = useState(null);
  const [extractedCode, setExtractedCode] = useState('');
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const canvasRef = useRef(null);
  const keyFileInputRef = useRef(null);

  const [audioBuffer, setAudioBuffer] = useState(null);
  const [filename, setFilename] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [sampleRate, setSampleRate] = useState(48000);
  const [numberOfChannels, setNumberOfChannels] = useState(2);

  const [audioContext] = useState(() => new (window.AudioContext || window.webkitAudioContext)());
  const VIEW_SPAN = 10; // 10 seconds viewable area

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [allowLeakChecking, setAllowLeakChecking] = useState(false);
  const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
  const [actionCost, setActionCost] = useState(5); // Cost for leak checking
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
      error('Invalid or corrupted key file');
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('audio/')) {
      showError("Please select a valid audio file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showError("File size must be less than 50MB");
      return;
    }

    setSelectedFile(file);
    setAudioFile(file);
    setFilename(file.name);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setCheckStatus('idle');
    setLeakData(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);

      setAudioBuffer(buffer);
      setAudioDuration(buffer.duration);
      setSampleRate(buffer.sampleRate);
      setNumberOfChannels(buffer.numberOfChannels);

      // Set audio player source
      if (audioRef.current) {
        audioRef.current.src = objectUrl;
      }

      // Draw initial waveform
      if (canvasRef.current) {
        drawWaveform(buffer, canvasRef.current, audioRef.current);
      }

      success(`Selected: ${file.name} (${buffer.duration.toFixed(2)}s)`);
    } catch (err) {
      console.error("Error processing audio file:", err);
      showError('Error loading audio file');
    }
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
    if (!selectedFile) {
      showError("Please select a audio file first");
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
      showError(`Failed to check audio: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAudioFile(null);
    setPreviewUrl(null);
    setCheckStatus('idle');
    setLeakData(null);
    setExtractedCode('');
    setAudioBuffer(null);
    setFilename('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (audioRef.current) audioRef.current.src = '';
  };

  // Update waveforms on time update
  useEffect(() => {
    const audioPlayer = audioRef.current;
    const canvas = canvasRef.current;

    const updateWaveform = () => {
      if (audioBuffer && canvas && audioPlayer) {
        drawWaveform(audioBuffer, canvas, audioPlayer);
      }
    };

    if (audioPlayer) {
      audioPlayer.addEventListener('timeupdate', updateWaveform);
      audioPlayer.addEventListener('loadedmetadata', updateWaveform);

      return () => {
        audioPlayer.removeEventListener('timeupdate', updateWaveform);
        audioPlayer.removeEventListener('loadedmetadata', updateWaveform);
      };
    }
  }, [audioBuffer]);

  // =============================
  // WAVEFORM DRAWING
  // =============================
  const drawWaveform = (audioBuffer, canvas, audioElement) => {
    if (!audioBuffer || !canvas) return;

    const ctx = canvas.getContext('2d');
    const { duration, sampleRate } = audioBuffer;
    const currentTime = audioElement?.currentTime || 0;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const channelData = audioBuffer.getChannelData(0);

    const viewStart = currentTime - VIEW_SPAN / 2;
    const viewEnd = currentTime + VIEW_SPAN / 2;
    const viewDuration = viewEnd - viewStart;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    const center = canvasHeight / 2;
    ctx.beginPath();
    ctx.moveTo(0, center);
    ctx.lineTo(canvasWidth, center);
    ctx.stroke();

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 1;
    const ampScale = canvasHeight / 2;

    for (let i = 0; i < canvasWidth; i++) {
      const t = viewStart + (i / canvasWidth) * viewDuration;

      if (t < 0 || t > duration) {
        if (i === 0) {
          ctx.moveTo(i, center);
        } else {
          ctx.lineTo(i, center);
        }
      } else {
        const sampleStart = Math.floor(t * sampleRate);
        const sampleEnd = Math.floor((t + viewDuration / canvasWidth) * sampleRate);
        const step = Math.max(1, sampleEnd - sampleStart);

        let min = 1.0;
        let max = -1.0;

        for (let j = 0; j < step; j++) {
          const sampleIndex = sampleStart + j;
          if (sampleIndex >= 0 && sampleIndex < channelData.length) {
            const sample = channelData[sampleIndex];
            if (sample < min) min = sample;
            if (sample > max) max = sample;
          }
        }

        if (i === 0 || (viewStart + ((i - 1) / canvasWidth) * viewDuration < 0)) {
          ctx.moveTo(i, (1 + min) * ampScale);
        }
        ctx.lineTo(i, (1 + min) * ampScale);
        ctx.lineTo(i, (1 + max) * ampScale);
      }
    }
    ctx.stroke();

    // Draw seeker line
    if (audioElement) {
      const seekerX = canvasWidth / 2;
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(seekerX, 0);
      ctx.lineTo(seekerX, canvasHeight);
      ctx.stroke();
    }
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
            <Speaker /> Upload Audio for Leak Detection
          </Typography>

          <Box sx={{ mb: 3 }}>
             <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Scrambled Audio File
                </Typography>
            <input type="file" accept="audio/*" onChange={handleFileSelect} style={{ display: 'none' }} id="audio-leak-upload" ref={fileInputRef} />
            <label htmlFor="audio-leak-upload">
              <Button variant="contained" component="span" startIcon={<Upload />} sx={{ backgroundColor: '#2196f3', color: 'white', mb: 2 }}>
                Choose Audio File
              </Button>
            </label>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Scramble Key File
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
                  <Button variant="contained" component="span" startIcon={<Upload />} sx={{ backgroundColor: '#2196f3', color: 'white', mb: 2 }}>
                    Choose Key File
                  </Button>
                </label>

              </Grid>

           <strong style={{fontSize: 24, margin: '0 16px'}}> OR </strong>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Enter Key Code
                </Typography>
                <TextField
                  fullWidth
                  multiline
                   rows={3}
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value)}
                  placeholder="eyJzZWVkIjoxMjM0NSwibiI6MywibSI6MywicGVybTFiYXNlZCI6WzMsMiw1LDEsNyw2LDksNCw4XX0="
                  sx={{
                    mb: 2,
                    '& .MuiInputBase-root': {
                      backgroundColor: '#353535',
                      color: 'white',
                      fontFamily: 'monospace'
                    }
                  }}
                />
              </Grid>
            </Grid>

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
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>Audio Preview</Typography>
              <Box sx={{ mt: 1, color: '#bdbdbd' }}>
                <Typography variant="caption" sx={{ mb: 2, display: 'block' }}>Preview of the selected audio file before leak checking.</Typography>
                <canvas ref={canvasRef} width="600" height="150" style={{ width: '100%', height: 'auto', border: '1px solid #666', borderRadius: '4px', marginBottom: '10px' }} />
                <audio ref={audioRef} controls style={{ width: '100%', borderRadius: '8px' }}>
                  <source src={previewUrl} type={selectedFile?.type} />
                  Your browser does not support the audio tag.
                </audio>
                {audioBuffer && (
                  <Typography variant="caption" sx={{ color: '#4caf50', mt: 1, display: 'block' }}>
                    Duration: {audioDuration.toFixed(2)}s | Sample Rate: {sampleRate}Hz | Channels: {numberOfChannels}
                  </Typography>
                )}
              </Box>
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
        creditCost={actionCost}
        currentCredits={userCredits}
        fileName={selectedFile?.name || ''}
        file={selectedFile}
        user={userData}
        isProcessing={false}
        fileDetails={{
          type: 'audio',
          size: selectedFile?.size || 0,
          name: selectedFile?.name || '',
          duration: audioRef.current?.duration || 0,
          sampleRate: sampleRate,
          numberOfChannels: numberOfChannels,
          // horizontal: audioRef.current?.audioWidth || 0,
          // vertical: audioRef.current?.audioHeight || 0
        }}


        actionType="audio-leak-check"
        actionDescription="audio leak detection"
      />
    </Container>
  );
}
