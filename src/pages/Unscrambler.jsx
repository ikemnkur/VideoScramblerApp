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
  LinearProgress
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
  Key,
  Movie
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';

export default function Unscrambler() {
  const { success, error } = useToast();

  // Refs for video and canvas elements
  const shufVideoRef = useRef(null);
  const unscrambleCanvasRef = useRef(null);
  const modalCanvasRef = useRef(null);

  // State variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [keyCode, setKeyCode] = useState('');
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

  // Rectangles for unscrambling
  const [rectsDest, setRectsDest] = useState([]);
  const [rectsSrcFromShuffled, setRectsSrcFromShuffled] = useState([]);
  const [srcToDest, setSrcToDest] = useState([]);

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

  const decodeKeyCode = () => {
    try {
      const json = fromBase64(keyCode);
      setDecodedParams(json);
      success('Key code decoded successfully!');
    } catch (e) {
      error('Invalid key code: ' + e.message);
    }
  };

  const applyParameters = () => {
    try {
      const obj = JSON.parse(decodedParams);
      const { n, m, permDestToSrc0 } = jsonToParams(obj);
      
      setUnscrambleParams({ n, m, permDestToSrc0 });
      success(`Parameters applied: ${n}×${m} grid`);
      
      // Play video briefly to show preview
      const video = shufVideoRef.current;
      if (video && video.paused) {
        video.play();
        setTimeout(() => video.pause(), 100);
      }
    } catch (e) {
      error('Invalid parameters: ' + e.message);
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
    setSrcToDest(inversePerm);
  };

  const drawUnscrambledFrame = useCallback((targetCanvas = null) => {
    const video = shufVideoRef.current;
    const canvas = targetCanvas || unscrambleCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !srcToDest.length) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const N = unscrambleParams.n * unscrambleParams.m;

    for (let origIdx = 0; origIdx < N; origIdx++) {
      const shuffledDestIdx = srcToDest[origIdx];
      const sR = rectsSrcFromShuffled[shuffledDestIdx];
      const dR = rectsDest[origIdx];
      if (!sR || !dR) continue;
      ctx.drawImage(video, sR.x, sR.y, sR.w, sR.h, dR.x, dR.y, dR.w, dR.h);
    }
  }, [srcToDest, rectsSrcFromShuffled, rectsDest, unscrambleParams]);

  const animateUnscramble = useCallback(() => {
    if (!isAnimating) return;
    const video = shufVideoRef.current;
    if (!video?.paused && !video?.ended) {
      drawUnscrambledFrame();
    }
    requestAnimationFrame(animateUnscramble);
  }, [isAnimating, drawUnscrambledFrame]);

  const showWatchModal = () => {
    const video = shufVideoRef.current;
    if (!video?.src) {
      error('Please select a scrambled video first');
      return;
    }
    if (!srcToDest.length) {
      error('Please apply scramble parameters first (Step 2)');
      return;
    }

    // Show ad modal first
    setShowAdModal(true);
    setAdProgress(0);
    setAdCanClose(false);

    // Simulate ad progress
    const progressInterval = setInterval(() => {
      setAdProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setAdCanClose(true);
          return 100;
        }
        return prev + 5;
      });
    }, 300);
  };

  const closeAdModal = () => {
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

  // ========== EFFECTS ==========

  useEffect(() => {
    if (unscrambleParams.n && unscrambleParams.m) {
      buildUnscrambleRects();
    }
  }, [unscrambleParams]);

  useEffect(() => {
    if (isAnimating) {
      animateUnscramble();
    }
  }, [isAnimating, animateUnscramble]);

  // Video event handlers
  useEffect(() => {
    const video = shufVideoRef.current;
    if (!video) return;

    const handlePlay = () => setIsAnimating(true);
    const handlePause = () => setIsAnimating(false);
    const handleSeeked = () => {
      if (!video.paused) drawUnscrambledFrame();
      if (showModal) drawUnscrambledFrame(modalCanvasRef.current);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [drawUnscrambledFrame, showModal]);

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Movie />
          🎞️ Video Unscrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload a scrambled video, enter the key code, and restore the original video.
        </Typography>
        
        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Canvas export: WebM" size="small" />
          <Chip label="Grid range: 9 - 100 cells" size="small" />
          <Chip label="Display: 50-100% resolution" size="small" />
        </Box>
      </Box>

      {/* Main Unscramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockOpen />
            Unscramble a Video
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
                Selected: {selectedFile.name}
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
                onClick={applyParameters}
                startIcon={<PlayArrow />}
                sx={{ backgroundColor: '#4caf50', color: 'white' }}
                disabled={!decodedParams}
              >
                Step 2: Apply & Preview
              </Button>
              
              <Button
                variant="contained"
                onClick={showWatchModal}
                startIcon={<Visibility />}
                sx={{ backgroundColor: '#f57c00', color: 'white' }}
                disabled={!srcToDest.length}
              >
                Step 3: Watch Unscrambled Video
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
                <video
                  ref={shufVideoRef}
                  onLoadedMetadata={handleVideoLoaded}
                  controls
                  style={{
                    width: '100%',
                    minHeight: '180px',
                    backgroundColor: '#0b1020',
                    border: '1px dashed #666',
                    borderRadius: '8px'
                  }}
                />
              </Grid>

              {/* Unscrambled Preview */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Unscrambled Video Preview
                </Typography>
                <canvas
                  ref={unscrambleCanvasRef}
                  style={{
                    width: '100%',
                    backgroundColor: '#0b1020',
                    border: '1px dashed #666',
                    borderRadius: '8px'
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Ad Modal */}
      <Modal open={showAdModal}>
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
      </Modal>

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
                height: '70%',
                backgroundColor: '#0b1020',
                borderRadius: '12px'
              }}
            />
          </Box>

          {/* Video Controls */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
              sx={{ width: 200, color: '#22d3ee' }}
            />
            
            <VolumeUp sx={{ color: 'white' }} />
            <Slider
              value={modalControls.volume}
              onChange={(_, value) => {
                const video = shufVideoRef.current;
                if (video) video.volume = value / 100;
                setModalControls(prev => ({ ...prev, volume: value }));
              }}
              sx={{ width: 100, color: '#22d3ee' }}
            />
          </Box>
        </Box>
      </Modal>
    </Container>
  );
}