// Unscrambler.jsx — Video Unscrambler React Component
// Converts the HTML unscrambler page to React with Material-UI styling
// Maintains all original functionality while integrating with the app's design system

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
  Slider,
  LinearProgress,
  Divider,
  duration
} from '@mui/material';
import {
  VideoFile,
  PlayArrow,
  Pause,
  VolumeUp,
  Close,
  LockOpen,
  Visibility,
  Download,
  VpnKey,
  Movie,
  AutoAwesome,
  CheckCircle,
  CloudDownload
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';
import { all } from 'axios';

export default function VideoUnscramblerBasic() {
  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';



  const { success, error } = useToast();

  // Refs for video and canvas elements
  const shufVideoRef = useRef(null);
  const unscrambleCanvasRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const keyFileInputRef = useRef(null);


  // State variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [keyCode, setKeyCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [decodedParams, setDecodedParams] = useState(null);
  const [unscrambleParams, setUnscrambleParams] = useState({
    n: 3, m: 3, permDestToSrc0: [0, 1, 2, 3, 4, 5, 6, 7, 8]
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalControls, setModalControls] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100
  });
  const [showAdModal, setShowAdModal] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [adCanClose, setAdCanClose] = useState(false);

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

  const [allowScrambling, setAllowScrambling] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
  const [actionCost, setActionCost] = useState(15);
  const [scrambleLevel, setScrambleLevel] = useState(1);

  // Rectangles for unscrambling
  const [rectsDest, setRectsDest] = useState([]);
  const [rectsSrcFromShuffled, setRectsSrcFromShuffled] = useState([]);
  const [srcToDest, setSrcToDest] = useState([]);




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

  // ========== UTILITY FUNCTIONS ==========

  // Base64 encoding/decoding utilities
  const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const fromBase64 = (b64) => decodeURIComponent(escape(atob(b64.trim())));

  // Array conversion utilities
  const oneBased = (a) => a.map(x => x + 1);
  const zeroBased = (a) => a.map(x => x - 1);

  // Calculate inverse permutation
  const inversePermutation = (arr) => {
    const inv = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) inv[arr[i]] = i;
    return inv;
  };

  // Generate rectangle coordinates for grid cells
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

  // Parse JSON parameters
  const jsonToParams = (obj) => {
    const n = Number(obj.n), m = Number(obj.m);
    let perm = null;
    if (Array.isArray(obj.perm1based)) perm = zeroBased(obj.perm1based);
    else if (Array.isArray(obj.perm0based)) perm = obj.perm0based.slice();

    if (!n || !m || !perm) throw new Error("Invalid params JSON: need n, m, and perm array");
    if (perm.length !== n * m) throw new Error("Permutation length doesn't match n*m");

    const seen = new Set(perm);
    if (seen.size !== perm.length || Math.min(...perm) !== 0 || Math.max(...perm) !== perm.length - 1)
      throw new Error("Permutation must contain each index 0..n*m-1 exactly once");
    return { n, m, permDestToSrc0: perm };
  };

  // ========== EVENT HANDLERS ==========

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const video = shufVideoRef.current;
    if (video) {
      video.src = URL.createObjectURL(file);
    }

    console.log("Selected file:", file);
  };

  const handleVideoLoaded = () => {
    const video = shufVideoRef.current;
    const canvas = unscrambleCanvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (unscrambleParams.n && unscrambleParams.m) {
      buildUnscrambleRects();
    }
  };

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
        console.log("Decoded Parameters from key file:", keyData);
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
          console.log("Decoded key data from base64:", keyData);
          success('🔑 Key file loaded and decoded successfully!');
        }
      }
    } catch (err) {
      console.error("Error loading key:", err);
      error('Invalid or corrupted key file. Please check the file format.');
    }
  };

  const decodeKeyCode = () => {
    try {
      // const json = fromBase64(keyCode);
      // setDecodedParams(json);
      const decoded = fromBase64(keyCode);
      const keyData = JSON.parse(decoded);
      setDecodedParams(keyData);
      localStorage.setItem('decodedParams', keyCode);
      success('Key code decoded successfully!');
      console.log("Decoded Parameters from key code entry:", keyData);
    } catch (e) {
      error('Invalid key code: ' + e.message);
    }
  };



  const handleProcessScrambledVideo = () => {
    if (!selectedFile) {
      error("Please load an video file first!");
      return;
    }
    // Skip to the end of video to figure out the true duration since some browsers don't load it fully


    console.log("shufVideoRef listed duration before:", shufVideoRef.current.duration);

    // // Use the video's reported duration directly
    // const video = shufVideoRef.current;

    // // If duration is not available yet, wait for metadata to load
    // if (!video.duration || isNaN(video.duration)) {
    //   video.addEventListener('loadedmetadata', () => {
    //     console.log("shufVideoRef actual duration after metadata loaded:", video.duration);
    //   }, { once: true });
    // } else {
    //   console.log("shufVideoRef actual duration after:", video.duration);
    // }

    setShowCreditModal(true);
  };

  const applyParameters = () => {
    try {
      // Validate decodedParams exists
      if (!decodedParams) {
        console.log("Applying Decoded Params:", decodedParams);
        throw new Error("No key parameters available. Please decode a key first.");
      }

      console.log("Applying Decoded Params:", decodedParams);

      // Check if decodedParams is already an object or needs parsing
      const obj = typeof decodedParams === 'string'
        ? JSON.parse(decodedParams)
        : decodedParams;

      console.log("Decoded Params Object:", obj);

      if (!obj || typeof obj !== 'object') {
        throw new Error("Invalid key format");
      }

      const { n, m, permDestToSrc0 } = jsonToParams(obj);
      console.log("Applying unscramble parameters:", n, m, permDestToSrc0);

      setUnscrambleParams({ n, m, permDestToSrc0 });
      success(`Parameters applied: ${n}×${m} grid`);
      setScrambleLevel(m >= n ? m : n);

      // Play video briefly to show preview
      const video = shufVideoRef.current;
      if (video && video.paused) {
        video.play();
        setTimeout(() => video.pause(), 50);
      }

      // if (!permDestToSrc0 || permDestToSrc0.length !== n * m) {
      // fecth from localStorage as fallback
      const storedSrcToDest = JSON.parse(localStorage.getItem('srcToDest'));
      if (storedSrcToDest && storedSrcToDest.length === n * m) {
        setSrcToDest(storedSrcToDest);
        console.log("Using stored srcToDest from localStorage:", storedSrcToDest);
      } else {
        throw new Error("Permutation length doesn't match n*m");
      }
      // }

      console.log("SrcToDest: ", srcToDest);

    } catch (e) {
      error('Invalid parameters: ' + e.message);
      console.error("Error applying parameters:", e);
      handleRefundCredits();
    }
  };


  const buildUnscrambleRects = () => {
    const video = shufVideoRef.current;
    const canvas = unscrambleCanvasRef.current;
    if (!video || !canvas) return;

    const destRects = cellRects(canvas.width, canvas.height, unscrambleParams.n, unscrambleParams.m);
    const srcRects = cellRects(video.videoWidth, video.videoHeight, unscrambleParams.n, unscrambleParams.m);
    const inversePerm = inversePermutation(unscrambleParams.permDestToSrc0);

    setRectsDest(destRects);
    setRectsSrcFromShuffled(srcRects);
    localStorage.setItem('srcToDest', JSON.stringify(inversePerm));
    setSrcToDest(inversePerm);
  };



  const drawUnscrambledFrame = useCallback((targetCanvas = null) => {
    const video = shufVideoRef.current;
    const canvas = targetCanvas || unscrambleCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !srcToDest.length) return;

    canvas.width = Math.floor(video.videoWidth / unscrambleParams.m) * unscrambleParams.m;
    canvas.height = Math.floor(video.videoHeight / unscrambleParams.n) * unscrambleParams.n;



    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const N = unscrambleParams.n * unscrambleParams.m;

    for (let origIdx = 0; origIdx < N; origIdx++) {
      const shuffledDestIdx = srcToDest[origIdx];
      const sR = rectsSrcFromShuffled[shuffledDestIdx];
      const dR = rectsDest[origIdx];
      if (!sR || !dR) continue;
      ctx.drawImage(video, sR.x, sR.y, sR.w, sR.h, dR.x, dR.y, dR.w, dR.h + 1);
    }

    // Add transparent watermark overlay to indicate unscrambled
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.font = '15px Arial';
    ctx.fillText(`🔓 Unscrambled by: ${userData.username}`, 10, canvas.height / 2 + 7);

  }, [srcToDest, rectsSrcFromShuffled, rectsDest, unscrambleParams]);



  const animateUnscramble = useCallback(() => {
    if (!isAnimating) return;
    const video = shufVideoRef.current;
    if (!video?.paused && !video?.ended) {
      drawUnscrambledFrame();
      // Also update modal canvas if modal is open
      if (showModal) {
        drawUnscrambledFrame(modalCanvasRef.current);
      }
    }
    requestAnimationFrame(animateUnscramble);
  }, [isAnimating, drawUnscrambledFrame, showModal]);



  // ------------monetization and modal handling------------

  // const showWatchModal = () => {
  //   const video = shufVideoRef.current;
  //   if (!video?.src) {
  //     error('Please select a scrambled video first');
  //     return;
  //   }
  //   if (!srcToDest.length) {
  //     error('Please apply scramble parameters first (Step 2)');
  //     return;
  //   }

  //   // Show ad modal first
  //   setShowAdModal(true);
  //   setAdProgress(0);
  //   setAdCanClose(false);

  //   // Simulate ad progress
  //   const progressInterval = setInterval(() => {
  //     setAdProgress(prev => {
  //       if (prev >= 100) {
  //         clearInterval(progressInterval);
  //         setAdCanClose(true);
  //         return 100;
  //       }
  //       return prev + 5;
  //     });
  //   }, 300);
  // };

  const openWatchVideoModal = () => {
    if (!adCanClose) return;
    setShowAdModal(false);
    setShowModal(true);

    // Setup modal canvas
    const modalCanvas = modalCanvasRef.current;
    const video = shufVideoRef.current;
    if (modalCanvas && video) {
      modalCanvas.width = video.videoWidth;
      modalCanvas.height = video.videoHeight;
      drawUnscrambledFrame(modalCanvas);
    }
  };

  const handleCreditConfirm = useCallback((actualCostSpent) => {
    setShowCreditModal(false);
    setAllowScrambling(true);

    // Now you have access to the actual cost that was calculated and spent
    console.log('Credits spent:', actualCostSpent);

    setActionCost(actualCostSpent);
    // alert("Applying Decoded Params:", decodedParams);


    let storedParams;
    if (decodedParams == null || decodedParams === '') {
      // check localStorage for decodedParams
      storedParams = JSON.parse(localStorage.getItem('decodedParams'));
      // if (storedParams) {
      const decoded = fromBase64(storedParams);
      storedParams = JSON.parse(decoded);
      setDecodedParams(storedParams);
      console.log("Using stored decoded parameters from localStorage:", storedParams);
      // }
    } else if (storedParams == null) {
      error("No key parameters available. Please decode a key first.");
    }


    // Apply parameters first
    applyParameters();

    // Use setTimeout to ensure state update completes before scrambling
    setTimeout(() => {
      unscrambleVideo();
    }, 0);

  }, [decodedParams]);

  // Refund credits on error using shared utility
  const handleRefundCredits = async () => {
    const result = await refundCredits({
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      credits: actionCost,
      currentCredits: userCredits,
      password: localStorage.getItem('passwordtxt'),
      params: decodedParams,
      action: 'unscramble_video_basic'
    });

    if (result.success) {
      error(`An error occurred during scrambling. ${result.message}`);
    } else {
      error(`Scrambling failed. ${result.message}`);
    }
  };

  // ========== EFFECTS ==========

  useEffect(() => {
    if (unscrambleParams.n && unscrambleParams.m) {
      buildUnscrambleRects();
    }
  }, [unscrambleParams]);

  useEffect(() => {
    if (srcToDest.length > 0) {
      const canvas = unscrambleCanvasRef.current;
      const video = shufVideoRef.current;
      if (canvas && video && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        drawUnscrambledFrame();
      }
    }
    if (srcToDest.length > 0) {
      const canvas = modalCanvasRef.current;
      const video = shufVideoRef.current;
      if (canvas && video && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        drawUnscrambledFrame(modalCanvasRef.current);
      }
    }
  }, [srcToDest, drawUnscrambledFrame]);

  useEffect(() => {
    if (isAnimating) {
      animateUnscramble();
    }
  }, [isAnimating, animateUnscramble]);

  // Video event handlers
  useEffect(() => {
    const video = shufVideoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsAnimating(true);
      setModalControls(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setIsAnimating(false);
      setModalControls(prev => ({ ...prev, isPlaying: false }));
    };

    const handleTimeUpdate = () => {
      setModalControls(prev => ({
        ...prev,
        currentTime: video.currentTime,
        duration: video.duration || prev.duration
      }));
    };

    const handleLoadedMetadata = () => {
      setModalControls(prev => ({
        ...prev,
        duration: video.duration,
        volume: video.volume * 100
      }));
    };

    const handleSeeked = () => {
      if (!video.paused) drawUnscrambledFrame();
      if (showModal) drawUnscrambledFrame(modalCanvasRef.current);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [drawUnscrambledFrame, showModal]);


  // ------------ FUNCTIONS TO UNSCRAMBLE VIDEO ------------

  const unscrambleVideo = () => {
    const video = shufVideoRef.current;
    if (!video)
      return;

    // set video play back to start
    video.currentTime = 0;
    // video.play();


    // Give time for state updates, then draw the unscrambled frame
    setTimeout(() => {
      const video = shufVideoRef.current;
      if (video && video.readyState >= 2) {
        // Draw initial frame to show preview immediately
        drawUnscrambledFrame();
      }
    }, 100);

  };

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <LockOpen />
          🔓 Video Unscrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Restore scrambled videos using your unscramble key
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Canvas Export: WebM" size="small" color="success" />
          <Chip label="Grid: 25-100 cells" size="small" />
          <Chip label="Free Plan/Watermarks" size="small" color="primary" />
        </Box>
      </Box>

      {/* Main Unscramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome />
            Unscramble Video
          </Typography>

          {/* Step 1: Upload Scrambled Video */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                Step 1
              </Typography>
              <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                Upload Scrambled Video
              </Typography>
            </Box>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="video-upload-unscramble"
            />
            <label htmlFor="video-upload-unscramble">
              <Button
                variant="contained"
                component="span"
                startIcon={<VideoFile />}
                sx={{ backgroundColor: '#2196f3', color: 'white', mb: 1 }}
              >
                Choose Scrambled Video
              </Button>
            </label>
            {selectedFile && (
              <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                ✓ Selected: {selectedFile.name}
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 3, backgroundColor: '#666' }} />

          {/* Step 2: Paste and Decode Key */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                Step 2
              </Typography>
              <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                Paste Your Unscramble Key
              </Typography>
            </Box>

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
                <Button variant="contained" component="span" sx={{ backgroundColor: '#2196f3', color: 'white', mb: 2 }}>
                  Choose Key File
                </Button>
              </label>

            </Grid>
            <strong style={{ fontSize: 24, margin: '0 16px' }}> OR </strong>
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

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Button
                variant="contained"
                onClick={decodeKeyCode}
                startIcon={<VpnKey />}
                disabled={!keyCode.trim()}
                sx={{ backgroundColor: '#ff9800', color: 'white' }}
              >
                Decode Key
              </Button>

              {decodedParams && (
                <Chip
                  icon={<CheckCircle />}
                  label="Valid Key Decoded"
                  color="success"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
            </Box>

            {/* Display Decoded Key Info */}
            {decodedParams && (() => {
              try {
                const obj = JSON.parse(decodedParams);
                const n = Number(obj.n);
                const m = Number(obj.m);
                return (
                  <Alert severity="success" sx={{ mt: 2, backgroundColor: '#2e7d32', color: 'white' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Key Information:
                    </Typography>
                    <Typography variant="body2">
                      • Grid Size: <strong>{n} × {m}</strong>
                    </Typography>
                    <Typography variant="body2">
                      • Total Cells: <strong>{n * m}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      ✓ Key validated and ready to apply
                    </Typography>
                  </Alert>
                );
              } catch (e) {
                return null;
              }
            })()}
          </Box>

          <Divider sx={{ my: 3, backgroundColor: '#666' }} />

          {/* Step 3: Apply Parameters & Preview */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                Step 3
              </Typography>
              <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                Apply Parameters & Preview
              </Typography>
            </Box>

            {/* Unscramble Action Buttons */}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={handleProcessScrambledVideo}
                startIcon={<PlayArrow />}
                disabled={!decodedParams}
                sx={{
                  backgroundColor: !decodedParams ? '#666' : '#4caf50',
                  color: !decodedParams ? '#999' : 'white'
                }}
              >
                Apply & Preview
              </Button>

              <Button
                variant="contained"
                onClick={openWatchVideoModal}
                startIcon={<Visibility />}
                disabled={!srcToDest.length}
                sx={{
                  backgroundColor: !srcToDest.length ? '#666' : '#22d3ee',
                  color: !srcToDest.length ? '#999' : '#001018',
                  fontWeight: 'bold',
                  minWidth: '200px'
                }}
              >
                Watch Unscrambled Video
              </Button>

              <Button
                variant="outlined"
                // onClick={() => setIsPro(true)}
                onClick={() => {
                  navigate('/plans')
                }}
                sx={{ borderColor: 'gold', color: 'gold', ml: 'auto' }}
              >
                Upgrade to Pro (No Ads)
              </Button>
            </Box>

            {(!selectedFile || !decodedParams || !srcToDest.length) && (
              <Alert severity="warning" sx={{ mt: 2, backgroundColor: '#ed6c02', color: 'white' }}>
                <Typography variant="body2">
                  {!selectedFile ? '⚠️ Please upload a scrambled video first' :
                    !decodedParams ? '⚠️ Please decode your key first' :
                      '⚠️ Please apply parameters to preview'}
                </Typography>
              </Alert>
            )}
          </Box>

          {/* Video Comparison */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3, mt: 3 }}>
            <Grid container spacing={3}>
              {/* Scrambled Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Scrambled Video (Input)
                </Typography>
                <Box sx={{
                  minHeight: '200px',
                  backgroundColor: '#0b1020',
                  border: '1px dashed #666',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <video
                    ref={shufVideoRef}
                    onLoadedMetadata={handleVideoLoaded}
                    controls
                    style={{
                      width: '100%',
                      minHeight: '180px',
                      backgroundColor: '#0b1020'
                    }}
                  />
                </Box>
              </Grid>

              {/* Unscrambled Preview */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Unscrambled Preview (Output)
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
                  {decodedParams ? (
                    <canvas
                      ref={unscrambleCanvasRef}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1020'
                      }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666', p: 2, textAlign: 'center' }}>
                      Unscrambled preview will appear here after applying parameters
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Info Section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 2 }}>
        <Typography variant="body2" color="black">
          💡 <strong>How it works:</strong> Upload your scrambled video and paste the unscramble key
          you received when the video was scrambled. The system will use the key's parameters to
          reverse the scrambling process and restore your original video.
        </Typography>
      </Paper>

      {/* Help Section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
        <Typography variant="body2" color="black">
          🔑 <strong>Lost your key?</strong> Unfortunately, without the unscramble key, the video cannot be restored.
          The key contains the grid parameters and permutation required to reverse the scrambling process.
          Always save your keys securely!
        </Typography>
      </Paper>

      {/* Ad Modal */}
      {/* <Modal open={showAdModal}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90vw', md: '640px' },
          height: { xs: '70vh', md: '480px' },
          bgcolor: '#424242',
          border: '2px solid #666',
          borderRadius: 2,
          p: 3,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Typography variant="h5" sx={{ mb: 2, color: 'white' }}>
            🎥 Processing Your Video...
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: '#e0e0e0' }}>
            Your unscrambled video is being generated. Please wait while we prepare your preview.
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
            <Box sx={{ width: '100%', maxWidth: 400 }}>
              <LinearProgress
                variant="determinate"
                value={adProgress}
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: '#e0e0e0' }}>
                {adProgress < 100 ? `Processing... ${adProgress}%` : 'Ready!'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={closeAdModal}
              disabled={!adCanClose}
              sx={{
                backgroundColor: adCanClose ? '#22d3ee' : '#666',
                color: adCanClose ? '#001018' : '#999'
              }}
            >
              {adCanClose ? 'Continue' : 'Please wait...'}
            </Button>
          </Box>
        </Box>
      </Modal> */}

      {/* Watch Video Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '85vw',
          maxWidth: '1200px',
          height: '90vh',
          bgcolor: '#424242',
          border: '2px solid #666',
          borderRadius: 2,
          p: 3,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ color: 'white' }}>
              🎥 Watch Unscrambled Video
            </Typography>
            <IconButton onClick={() => setShowModal(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>

          <Typography variant="body1" sx={{ mb: 2, color: '#e0e0e0' }}>
            Here is your unscrambled video preview. You can play/pause, seek through the video, and adjust the volume.
          </Typography>

          {/* Video Canvas */}
          <Box sx={{ flexGrow: 1, mb: 2 }}>
            <canvas
              ref={modalCanvasRef}
              style={{
                width: '100%',
                // height: '100%',
                backgroundColor: '#0b1020',
                borderRadius: '12px'
              }}
            />
          </Box>

          {/* Video Controls */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={modalControls.isPlaying ? <Pause /> : <PlayArrow />}
              onClick={() => {
                const video = shufVideoRef.current;
                if (video) {
                  if (video.paused) video.play();
                  else video.pause();
                }
              }}
            >
              {modalControls.isPlaying ? 'Pause' : 'Play'}
            </Button>


            <Typography variant="body2" sx={{ color: 'white' }}>Seek:</Typography>
            <Slider
              value={modalControls.currentTime}
              max={modalControls.duration || 100}
              onChange={(_, value) => {
                const video = shufVideoRef.current;
                if (video) video.currentTime = value;
              }}
              sx={{ maxWidth: '65%', color: '#22d3ee' }}
            />

            <VolumeUp sx={{ color: 'white' }} />
            <Slider
              value={modalControls.volume}
              onChange={(_, value) => {
                const video = shufVideoRef.current;
                if (video) video.volume = value / 100;
                setModalControls(prev => ({ ...prev, volume: value }));
              }}
              sx={{ maxWidth: 150, color: '#22d3ee' }}
            />

          </Box>
        </Box>
      </Modal>

      {/* Credit Confirmation Modal */}
      {showCreditModal && (
        <CreditConfirmationModal
          open={showCreditModal}
          // onClick={() => {
          //   setShowCreditModal(true);
          // }}
          onClose={() => setShowCreditModal(false)}
          onConfirm={handleCreditConfirm}
          mediaType="video"

          scrambleLevel={scrambleLevel}
          currentCredits={userCredits}
          fileName={selectedFile?.name || ''}
          file={selectedFile}
          fileDetails={{
            type: 'video',
            size: selectedFile?.size || 0,
            name: selectedFile?.name || '',
            horizontal: shufVideoRef.current?.videoWidth || 0,
            vertical: shufVideoRef.current?.videoHeight || 0,
            duration: Math.ceil(shufVideoRef.current?.duration) || 0
          }}
          user={userData}
          isProcessing={false}
          actionType="unscramble-video-free"
          actionDescription="free video unscrambling"
        />
      )}
    </Container>
  );
}