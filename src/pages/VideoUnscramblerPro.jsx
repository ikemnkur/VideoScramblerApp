// VideoUnscramblerPro.jsx — Video Unscrambler React Component (Pro Version)
// Unscrambles videos that were scrambled with the video scrambler pro
// Uses server-side processing for advanced unscrambling algorithms

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Box,
  Grid,
  Paper,
  Alert,
  IconButton,
  Chip,
  Modal,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import {
  VideoFile,
  Key,
  LockOpen,
  Download,
  Movie,
  VpnKey,
  CloudDownload,
  CloudUpload,
  AutoAwesome,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';

export default function VideoUnscramblerPro() {
  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';
  const Flask_API_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000';

  const { success, error } = useToast();

  // Refs for video elements
  const displayVideoRef = useRef(null);
  const scrambledVideoRef = useRef(null);
  const unscrambledVideoRef = useRef(null);

  // State variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [keyCode, setKeyCode] = useState('');
  const [decodedParams, setDecodedParams] = useState(null);
  const [scrambledFilename, setScrambledFilename] = useState('');
  const [unscrambledFilename, setUnscrambledFilename] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [unscrambledReady, setUnscrambledReady] = useState(false);

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));
  const [allowUnscrambling, setAllowUnscrambling] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const SCRAMBLE_COST = 15; // Cost to unscramble a video (pro version)


  // ========== UTILITY FUNCTIONS ==========

  // Base64 encoding/decoding utilities
  const fromBase64 = (b64) => decodeURIComponent(escape(atob(b64.trim())));

  // ========== EVENT HANDLERS ==========

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      error("Please select a valid video file");
      return;
    }

    setSelectedFile(file);
    setVideoLoaded(false);
    setUnscrambledReady(false);
    setScrambledFilename('');
    setUnscrambledFilename('');

    const url = URL.createObjectURL(file);
    const video = scrambledVideoRef.current;

    if (video) {
      video.onloadedmetadata = () => {
        console.log("Video loaded successfully");
        setVideoLoaded(true);
        URL.revokeObjectURL(url);
      };

      video.onerror = () => {
        error("Failed to load the selected video");
        setVideoLoaded(false);
        URL.revokeObjectURL(url);
      };

      video.src = url;
    }
  };

  const decodeKeyCode = () => {
    try {
      const json = fromBase64(keyCode);
      const params = JSON.parse(json);
      setDecodedParams(params);
      success('Key code decoded successfully!');
    } catch (e) {
      error('Invalid key code: ' + e.message);
    }
  };

  const unscrambleVideo = async () => {
    if (!selectedFile) {
      error("Please select a video first");
      return;
    }

    if (!decodedParams) {
      error("Please decode the key code first");
      return;
    }

    if (!allowUnscrambling) {
      error("You need to confirm credit usage before unscrambling");
      return;
    }

    setIsProcessing(true);

    try {
      // Create FormData with file and parameters
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('params', JSON.stringify({
        ...decodedParams,
        mode: 'unscramble',
        input: selectedFile.name,
        output: `unscrambled_${selectedFile.name}`
      }));

      // Call unscramble endpoint
      const response = await fetch(`${API_URL}/api/unscramble-video`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        // Refund credits if unscrambling failed
        try {
          await api.post(`${API_URL}/api/refund-credits`, {
            username: userData?.username,
            email: userData?.email,
            password: localStorage.getItem('passwordtxt'),
            cost: SCRAMBLE_COST
          });
        } catch (refundErr) {
          console.error("Refund failed:", refundErr);
        }
        throw new Error(data.error || data.message || 'Unscrambling failed');
      }

      setUnscrambledFilename(data.output_file || data.unscrambledFileName);
      setUnscrambledReady(true);

      // Load unscrambled video preview
      await loadUnscrambledVideo(data.output_file);

      success("Video unscrambled successfully!");
    } catch (err) {
      error("Unscrambling failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadUnscrambledVideo = async (filename) => {
    try {
      const response = await fetch(`${Flask_API_URL}/download/${filename}`);
      if (!response.ok) throw new Error('Failed to load unscrambled video');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (unscrambledVideoRef.current) {
        unscrambledVideoRef.current.src = url;
      }
    } catch (err) {
      error("Failed to load unscrambled video: " + err.message);
    }
  };

  const downloadUnscrambledVideo = async () => {
    if (!unscrambledFilename) {
      error("Please unscramble a video first");
      return;
    }

    try {
      const response = await fetch(`${Flask_API_URL}/download/${unscrambledFilename}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = unscrambledFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      success("Unscrambled video downloaded!");
    } catch (err) {
      error("Download failed: " + err.message);
    }
  };

  const handleCreditConfirm = useCallback(() => {
    setShowCreditModal(false);
    setAllowUnscrambling(true);

    setTimeout(() => {
      unscrambleVideo();
    }, 50);
  }, [selectedFile, decodedParams, allowUnscrambling]);

  useEffect(() => {
    const fetchUserData = async () => {
      const userData = JSON.parse(localStorage.getItem("userdata"));
      setUserData(userData);

      if (userData) {
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
          console.error("Failed to fetch user credits:", err);
        }
      }
    };

    fetchUserData();
  }, []);

  // Remove old photo-related code from here
  const cellRects = (w, h, n, m) => {
    const rects = [];
    const cw = w / m, ch = h / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < m; c++) {
        rects.push({ x: c * cw, y: r * ch, w: cw, h: ch });
      }
    }
    return rects;
  };

  // Note: Old photo-related canvas drawing functions removed for video processing
  const drawUnscrambledImage = useCallback((
  ) => {
    // Placeholder for future canvas-based preview if needed
  }, []);

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Movie />
          🎬 Video Unscrambler Pro
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload a scrambled video, enter the key code, and restore the original using server-side processing.
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Format: MP4, AVI, MOV" size="small" />
          <Chip label="Server Processing" size="small" />
          <Chip label="Advanced Algorithms" size="small" />
          <Chip icon={<AutoAwesome />} label="Pro Version" color="secondary" size="small" />
        </Box>
      </Box>

      {/* Main Unscramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockOpen />
            Unscramble a Video (Server-Side Processing)
          </Typography>

          {/* File Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Upload Scrambled Video
            </Typography>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="video-upload"
            />
            <label htmlFor="video-upload">
              <Button
                variant="contained"
                component="span"
                startIcon={<VideoFile />}
                sx={{ backgroundColor: '#2196f3', color: 'white' }}
              >
                Choose Video File
              </Button>
            </label>
            {selectedFile && (
              <Typography variant="body2" sx={{ mt: 1, color: '#4caf50' }}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            )}
            {videoLoaded && scrambledVideoRef.current && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#4caf50' }}>
                Video loaded: {scrambledVideoRef.current.videoWidth}×{scrambledVideoRef.current.videoHeight}px, {scrambledVideoRef.current.duration.toFixed(2)}s
              </Typography>
            )}
          </Box>

          {/* Key Code Input */}
          <Box sx={{ mb: 3 }}>
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

            {/* Step buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={decodeKeyCode}
                startIcon={<Key />}
                sx={{ backgroundColor: '#9c27b0', color: 'white' }}
                disabled={!keyCode.trim()}
              >
                Step 1: Decode Key
              </Button>

              <Button
                variant="contained"
                onClick={() => setShowCreditModal(true)}
                startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudUpload />}
                disabled={!videoLoaded || !decodedParams || isProcessing}
                sx={{
                  backgroundColor: (!videoLoaded || !decodedParams || isProcessing) ? '#666' : '#4caf50',
                  color: (!videoLoaded || !decodedParams || isProcessing) ? '#999' : 'white',
                  fontWeight: 'bold'
                }}
              >
                {isProcessing ? 'Processing...' : 'Step 2: Unscramble Video'}
              </Button>

              <Button
                variant="outlined"
                onClick={downloadUnscrambledVideo}
                startIcon={<Download />}
                sx={{ borderColor: '#22d3ee', color: '#22d3ee' }}
                disabled={!unscrambledReady}
              >
                Download Unscrambled Video
              </Button>
            </Box>
          </Box>

          {/* Video Comparison */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
            <Grid container spacing={3}>
              {/* Scrambled Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Scrambled Video
                </Typography>
                <Box sx={{
                  minHeight: '200px',
                  backgroundColor: '#0b1020',
                  border: '1px dashed #666',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {videoLoaded ? (
                    <video
                      ref={scrambledVideoRef}
                      // src={scrambledVideoRef.current?.src || ''}
                      controls
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        borderRadius: '8px'
                      }}
                    />
                  ) : selectedFile ? (
                    <Typography variant="body2" sx={{ color: '#ff9800' }}>
                      Loading video...
                    </Typography>
                  ) : (
                    <>
                     <video
                      ref={scrambledVideoRef}
                      controls
                      style={{
                        // display: 'none',
                        maxWidth: '100%',
                        maxHeight: '400px',
                        borderRadius: '8px'
                      }}
                    />
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Select a scrambled video to preview
                    </Typography>
                    </>
                    
                  )}
                </Box>
              </Grid>

              {/* Unscrambled Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Unscrambled Video Preview
                </Typography>
                <Box sx={{
                  minHeight: '200px',
                  backgroundColor: '#0b1020',
                  border: '1px dashed #666',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>

                  {unscrambledReady ? (
                    <video
                      ref={unscrambledVideoRef}
                      controls
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        borderRadius: '8px'
                      }}
                    />
                  ) : isProcessing ? (
                    <Box sx={{ textAlign: 'center' }}>
                      <CircularProgress sx={{ color: '#22d3ee', mb: 2 }} />
                      <Typography variant="body2" sx={{ color: '#22d3ee' }}>
                        Processing video on server...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        Unscrambled video will appear here
                      </Typography>
                      <video
                        ref={unscrambledVideoRef}
                        controls
                        style={{
                          // display: 'none',
                          maxWidth: '100%',
                          maxHeight: '400px',
                          borderRadius: '8px'
                        }}
                      />
                    </>

                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Info section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 4 }}>
        <Typography variant="body2" color="black">
          💡 <strong>Pro Version:</strong> Upload a scrambled video and your key code. The server processes your video using
          advanced algorithms (position, color, rotation, mirror, intensity) to restore the original content.
          This requires {SCRAMBLE_COST} credits per video.
        </Typography>
      </Paper>

      {/* Credit Confirmation Modal */}
      <CreditConfirmationModal
        open={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onConfirm={handleCreditConfirm}
        mediaType="video"
        creditCost={SCRAMBLE_COST}
        currentCredits={userCredits}
        file={selectedFile}
        fileName={selectedFile?.name || ''}
        fileDetails={{
          type: 'video',
          size: selectedFile?.size || 0,
          name: selectedFile?.name || '',
          horizontal: scrambledVideoRef.current?.videoWidth || 0,
          vertical: scrambledVideoRef.current?.videoHeight || 0,
          duration: scrambledVideoRef.current?.duration || 0
        }}
        user={userData}
        isProcessing={isProcessing}
        actionType="unscramble-video-pro"
        actionDescription="pro video unscrambling"
      />
    </Container>
  );
}