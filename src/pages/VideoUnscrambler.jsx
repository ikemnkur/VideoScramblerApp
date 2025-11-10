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
  Divider
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

export default function VideoUnscrambler() {
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
          <LockOpen />
          🔓 Video Unscrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Restore scrambled videos using your unscramble key
        </Typography>
        
        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Canvas Export: WebM" size="small" color="success" />
          <Chip label="Grid: 9-100 cells" size="small" />
          <Chip label="Pro Features Enabled" size="small" color="primary" />
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

            <TextField
              fullWidth
              multiline
              rows={4}
              value={keyCode}
              onChange={(e) => setKeyCode(e.target.value)}
              placeholder="Paste your unscramble key here..."
              InputProps={{
                sx: {
                  fontFamily: 'monospace',
                  backgroundColor: '#353535',
                  color: 'white'
                }
              }}
              sx={{ mb: 2 }}
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
            {decodedParams && (
              <Alert severity="success" sx={{ mt: 2, backgroundColor: '#2e7d32', color: 'white' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Key Information:
                </Typography>
                <Typography variant="body2">
                  • Grid Size: <strong>{unscrambleParams.n} × {unscrambleParams.m}</strong>
                </Typography>
                <Typography variant="body2">
                  • Total Cells: <strong>{unscrambleParams.n * unscrambleParams.m}</strong>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  ✓ Key validated and ready to apply
                </Typography>
              </Alert>
            )}
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

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={applyParameters}
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
                onClick={showWatchModal}
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
                  {srcToDest.length > 0 ? (
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
        <Typography variant="body2" color="text.secondary">
          💡 <strong>How it works:</strong> Upload your scrambled video and paste the unscramble key 
          you received when the video was scrambled. The system will use the key's parameters to 
          reverse the scrambling process and restore your original video.
        </Typography>
      </Paper>

      {/* Help Section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
        <Typography variant="body2" color="text.secondary">
          🔑 <strong>Lost your key?</strong> Unfortunately, without the unscramble key, the video cannot be restored. 
          The key contains the grid parameters and permutation required to reverse the scrambling process. 
          Always save your keys securely!
        </Typography>
      </Paper>

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