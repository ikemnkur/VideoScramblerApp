// ScramblerPhotos.jsx — Simple Photo Scrambler (React)
// Notes:
// - Photo scrambling version with watermark and metadata header
// - Upload an image, choose scramble level, and download your unscramble key
// - Exports scrambled images as PNG files with 64px top margin for metadata
// - Adds watermark before scrambling

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Chip,
  Alert
} from '@mui/material';
import {
  PhotoCamera,
  Shuffle,
  Download,
  ContentCopy,
  Key,
  Settings
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom'; 
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';


// Simple Photo Scrambler (React)
// Notes:
// - Photo scrambling version with watermark and metadata header
// - Upload an image, choose scramble level, and download your unscramble key
// - Exports scrambled images as PNG files with 64px top margin for metadata
// - Adds watermark before scrambling
// - “Subscription-ready”: a tiny gate is included (isPro) to demo how you’d disable ads / waiting for paid users.
// - Replace the mock auth/subscription bits in the "// SUBSCRIPTION HOOKS" area with your real auth and Stripe/etc.

export default function PhotoScrambler() {

  const navigate = useNavigate();
  // export default function App() {
  const { success, error } = useToast();

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';

  // =============================
  // SUBSCRIPTION HOOKS (mock)
  // =============================
  const [user] = useState({ id: "demo-user-123", email: "demo@example.com", username: "photoartist" });
  const [isPro, setIsPro] = useState(false);
  const togglePro = () => setIsPro((p) => !p);

  // =============================
  // STATE & REFS
  // =============================
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const displayImageRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkCanvasRef = useRef(null);

  const [selectedLevel, setSelectedLevel] = useState("med"); // low|med|high
  const [grid, setGrid] = useState({ n: 8, m: 8 }); // Increased grid values for photos

  const [seed, setSeed] = useState(() => genRandomSeed());
  const [permDestToSrc0, setPermDestToSrc0] = useState([]);
  const [base64Key, setBase64Key] = useState("");
  const [jsonKey, setJsonKey] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Ad modal state
  const [modalShown, setModalShown] = useState(false);
  const [modalReady, setModalReady] = useState(false);
  const [timerText, setTimerText] = useState("Please wait...");
  const [processingFinished, setProcessingFinished] = useState(false);
  const [waitTimeRemaining, setWaitTimeRemaining] = useState(10);

  // Credit modal state
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
  const [actionCost, setActionCost] = useState(5); // Cost to scramble a photo (less than video)
  const [scrambleLevel, setScrambleLevel] = useState(8); // New state for scramble level

  const [selectedFile, setSelectedFile] = useState(null);
  // const [scrambledFilename, setScrambledFilename] = useState('');
  const [keyCode, setKeyCode] = useState('');

  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  // const [imageLoaded, setImageLoaded] = useState(false);


  // =============================
  // FILE HANDLING
  // =============================
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error("Please select a valid image file");
      return;
    }

    setSelectedFile(file);
    setImageFile(file); // Also set imageFile for scrambling logic
    // setScrambledFilename('');
    setKeyCode('');

    // Reset previous state
    setPermDestToSrc0([]);
    setBase64Key("");
    setJsonKey("");
    setImageLoaded(false);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Load image into the hidden image ref for processing
    if (imageRef.current) {
      imageRef.current.onload = () => {
        console.log("Image loaded successfully");
        setImageLoaded(true);
        updateCanvas();
        URL.revokeObjectURL(url);
      };

      imageRef.current.onerror = () => {
        console.error("Failed to load image");
        error("Failed to load the selected image");
        setImageLoaded(false);
        URL.revokeObjectURL(url);
      };

      imageRef.current.src = url;
    }
  };

  // =============================
  // UTILS
  // =============================
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function genRandomSeed() {
    if (window.crypto?.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] >>> 0;
    }
    return (Math.floor(Math.random() * 2 ** 32) >>> 0);
  }
  function seededPermutation(size, seed) {
    const rand = mulberry32(seed >>> 0);
    const srcs = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [srcs[i], srcs[j]] = [srcs[j], srcs[i]];
    }
    return srcs; // dest index i will take from source srcs[i]
  }
  function oneBased(a) { return a.map((x) => x + 1); }
  function paramsToJSON(seed, n, m, perm) {
    return {
      version: 2,
      seed: Number(seed),
      n: Number(n),
      m: Number(m),
      perm1based: oneBased(perm),
      semantics: "Index = destination cell (1-based), value = source cell index (1-based)",
    };
  }
  function toBase64(str) { return btoa(unescape(encodeURIComponent(str))); }

  function cellRects(w, h, n, m) {
    const rects = [];
    const cw = w / m, ch = h / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < m; c++) {
        rects.push({ x: c * cw, y: r * ch, w: cw, h: ch });
      }
    }
    return rects;
  }

  function download(filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2500);
  }

  // =============================
  // GRID & BUTTON STATES - Updated for photos
  // =============================
  useEffect(() => {
    if (selectedLevel === "low") setGrid({ n: 6, m: 6 });      // 36 pieces
    else if (selectedLevel === "med") setGrid({ n: 8, m: 8 }); // 64 pieces
    else if (selectedLevel === "high") setGrid({ n: 10, m: 10 }); // 100 pieces
    setScrambleLevel(selectedLevel === "low" ? 6 : selectedLevel === "med" ? 8 : 10);
  }, [selectedLevel]);

  // =============================
  // IMAGE/CANVAS SETUP
  // =============================
  const updateCanvas = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !imageLoaded) return;

    // Add 64px black margin at top for metadata
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight + 64;
  }, [imageLoaded]);


  // =============================
  // DRAW SCRAMBLED IMAGE
  // =============================
  const drawScrambledImage = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !imageLoaded) return;

    const N = grid.n * grid.m;
    if (!permDestToSrc0 || permDestToSrc0.length !== N) return;

    const ctx = canvas.getContext("2d");

    // Step 1: Calculate padded dimensions to be evenly divisible by grid size
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    // Round up to nearest multiple of grid size
    const paddedWidth = Math.floor(originalWidth / grid.m) * grid.m;
    const paddedHeight = Math.floor(originalHeight / grid.n) * grid.n;

    // Step 2: Set canvas size with padded dimensions + 128px border
    canvas.width = paddedWidth + 128;
    canvas.height = paddedHeight + 128;

    // Step 3: Fill entire canvas with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const offsetX = 64; // Center offset
    const offsetY = 64; // Center offset

    // Step 4: Draw original image onto a temporary canvas with padding
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = paddedWidth;
    tempCanvas.height = paddedHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill temp canvas with black (for padding areas)
    tempCtx.fillStyle = '#000000';
    tempCtx.fillRect(0, 0, paddedWidth, paddedHeight);

    // Draw original image (centered if there's padding)
    tempCtx.drawImage(image, 0, 0);

    // Step 5: Scramble the padded image into the center area
    const srcRects = cellRects(paddedWidth, paddedHeight, grid.n, grid.m);
    const destRects = cellRects(paddedWidth, paddedHeight, grid.n, grid.m);

    for (let destIdx = 0; destIdx < N; destIdx++) {
      const srcIdx = permDestToSrc0[destIdx];
      const sR = srcRects[srcIdx];
      const dR = destRects[destIdx];
      if (!sR || !dR) continue;

      // Draw scrambled pieces with offset to center them
      ctx.drawImage(
        tempCanvas,
        sR.x, sR.y, sR.w, sR.h,
        dR.x + offsetX, dR.y + offsetY, dR.w, dR.h
      );
    }

    // Step 6: Add metadata text on top of scrambled image (readable)
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(`Scrambled by: ${userData.username || 'Anonymous'}`, 10, 20);
    // ctx.fillText(`Scramble Level: ${selectedLevel.toUpperCase()} (${grid.n}×${grid.m})`, 10, 40);
    ctx.fillText('Unscramble this image using the VideoScrambler app', 10, 40);

    // Step 7: Add subtle watermark on the scrambled image (centered, readable)
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    const centerX = canvas.width / 2;
    const centerY = canvas.height - offsetY / 2 + (offsetY - 48);
    ctx.fillText('SCRAMBLED', centerX, centerY);
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';

  }, [grid, permDestToSrc0, imageLoaded, user.username, selectedLevel]);

  // =============================
  // EVENTS
  // =============================


  const onGenerate = useCallback(() => {
    if (!imageFile) {
      error("Please select an image file first");
      return;
    }
    if (!imageLoaded) {
      error("Please wait for the image to load");
      return;
    }

    // Show credit confirmation modal before scrambling
    setShowCreditModal(true);
  }, [imageFile, imageLoaded, error]);

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

  const handleCreditConfirm = useCallback((actualCostSpent) => {
    setShowCreditModal(false);
    setIsProcessing(true);

    // Now you have access to the actual cost that was calculated and spent
    console.log('Credits spent:', actualCostSpent);

    // You can use this value for logging, analytics, or displaying to user
    setActionCost(actualCostSpent);
    // setAllowScrambling(true);


    setTimeout(() => {
      const newSeed = genRandomSeed();
      setSeed(newSeed);

      const N = grid.n * grid.m;
      const perm = seededPermutation(N, newSeed);
      setPermDestToSrc0(perm);

      // create key JSON
       const obj = paramsToJSON(newSeed, grid.n, grid.m, perm, userData.username || 'Anonymous', userData.userId || 'Unknown', new Date().toISOString());//, grid.n, grid.m, perm, userData.username ||'Anonymous', userData.userId || 'Unknown',   timestamp=new Date().toISOString());
      const pretty = JSON.stringify(obj, null, 2);
      setJsonKey(pretty);
      setBase64Key(toBase64(pretty));

      // Draw scrambled image
      drawScrambledImage();

      setIsProcessing(false);

      // Deduct credits
      setUserCredits(prev => prev - actionCost);

      // Show success message
      success(`Image scrambled successfully! ${actionCost} credits used.`);
    }, 500);
  }, [grid, drawScrambledImage, success, actionCost]);

  // Redraw when image loads or parameters change
  useEffect(() => {
    if (imageLoaded && permDestToSrc0.length > 0) {
      drawScrambledImage();
    }
  }, [imageLoaded, drawScrambledImage, permDestToSrc0]);




  // =============================
  // DOWNLOAD SCRAMBLED IMAGE
  // =============================
  const onDownloadScrambled = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!imageFile) {
      error("Please select an image file first");
      return;
    }
    if (!imageLoaded) {
      error("Please wait for the image to load");
      return;
    }
    if (!permDestToSrc0 || permDestToSrc0.length === 0) {
      error("Please scramble the image first");
      return;
    }

    // Show ad modal for free users
    if (!isPro) {
      showAdModal();
    }


  }, [permDestToSrc0, imageLoaded, imageFile, isPro, error, success]);

  // =============================
  // AD MODAL - Updated for photo processing
  // =============================
  const showAdModal = useCallback(() => {
    if (isPro) {
      return; // Pro users skip modal entirely
    }

    setModalReady(false);
    setProcessingFinished(false);
    setWaitTimeRemaining(10);
    setModalShown(true);
    setTimerText("Processing image...");

    // Simulate processing time
    setTimeout(() => {
      setProcessingFinished(true);
      setTimerText("Processing complete!");
    }, 2000);

    // Start countdown timer
    const interval = setInterval(() => {
      setWaitTimeRemaining((prev) => {
        if (prev <= 1) {
          setModalReady(true);
          setTimerText("Ready! You can close this window.");
          clearInterval(interval);

          // // Convert canvas to blob and download
          // canvas.toBlob((blob) => {
          //   if (blob) {
          //     download(selectedFile.name + "-scrambled-image.png", blob);
          //     success("Scrambled image downloaded successfully!");
          //   }
          // }, "image/png", 1.0);

          return 0;
        }
        setTimerText(`Please wait ${prev - 1} seconds...`);
        return prev - 1;
      });
    }, 1000);
  }, [isPro]);

  const hideAdModal = useCallback(() => {
    setModalShown(false);
  }, []);

  const onCloseModal = useCallback(() => {

    const canvas = canvasRef.current;
    if (isPro || modalReady) hideAdModal();
    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      if (blob) {
        download(selectedFile.name + "-scrambled-image.png", blob);
        success("Scrambled image downloaded successfully!");
      }
    }, "image/png", 1.0);

  }, [hideAdModal, isPro, modalReady]);

  // =============================
  // COPY & DOWNLOAD KEY
  // =============================
  const onCopyKey = useCallback(async () => {
    if (!base64Key) {
      error("Please scramble an image first to generate a key");
      return;
    }
    try {
      await navigator.clipboard.writeText(base64Key);
      success("Key copied to clipboard!");
    } catch {
      error("Copy failed. Please select and copy manually.");
    }
  }, [base64Key, error, success]);

  const onDownloadKey = useCallback(() => {
    if (!base64Key) {
      error("Please scramble an image first to generate a key");
      return;
    }
    const blob = new Blob([base64Key], { type: "text/plain" });
    download(selectedFile.name + "unscramble_key.txt", blob);
    success("Key file downloaded successfully!");
  }, [base64Key, error, success]);

  // =============================
  // RENDER
  // =============================
  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <PhotoCamera />
          🖼️ Photo Scrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload an image, choose scramble level, and download your unscramble key.
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Export: PNG" size="small" />
          <Chip label="Quality: Lossless" size="small" />
          <Chip label={`Plan: ${isPro ? "Pro" : "Free"}`} size="small" color={isPro ? "success" : "default"} />
        </Box>
      </Box>

      {/* Main Scramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Shuffle />
            Scramble a Photo
          </Typography>

          {/* File Upload and Settings */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                Select Image File
              </Typography>
              <input
                type="file"
                accept="image/*"
                // onChange={onPickFile}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="image-upload"
                ref={fileRef}
              />
              <label htmlFor="image-upload">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<PhotoCamera />}
                  sx={{ backgroundColor: '#2196f3', color: 'white', mb: 1 }}
                >
                  Choose Image File
                </Button>
              </label>
              {imageFile && (
                <Typography variant="body2" sx={{ color: '#4caf50' }}>
                  Selected: {imageFile.name}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                Scramble Level
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Button
                  variant={selectedLevel === "low" ? "contained" : "outlined"}
                  onClick={() => { setSelectedLevel("low"); setScrambleLevel(6); }}
                  sx={{
                    backgroundColor: selectedLevel === "low" ? '#4caf50' : 'transparent',
                    borderColor: '#4caf50',
                    color: 'white'
                  }}
                >
                  Low (6×6)
                </Button>
                <Button
                  variant={selectedLevel === "med" ? "contained" : "outlined"}
                  onClick={() => { setSelectedLevel("med"); setScrambleLevel(8); }}
                  sx={{
                    backgroundColor: selectedLevel === "med" ? '#2196f3' : 'transparent',
                    borderColor: '#2196f3',
                    color: 'white'
                  }}
                >
                  Medium (8×8)
                </Button>
                <Button
                  variant={selectedLevel === "high" ? "contained" : "outlined"}
                  onClick={() => { setSelectedLevel("high"); setScrambleLevel(10); }}
                  sx={{
                    backgroundColor: selectedLevel === "high" ? '#f44336' : 'transparent',
                    borderColor: '#f44336',
                    color: 'white'
                  }}
                >
                  High (10×10)
                </Button>
              </Box>
              <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                Choose how many pieces to split your image into
              </Typography>
            </Grid>
          </Grid>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button
              variant="contained"
              // onClick={onGenerate}
              onClick={() => {
                setShowCreditModal(true);

                // setScrambleLevel(cols >= rows ? cols : rows);
                onGenerate();
              }}
              startIcon={<Shuffle />}
              disabled={!imageLoaded || isProcessing}
              sx={{
                backgroundColor: (!imageLoaded || isProcessing) ? '#666' : '#22d3ee',
                color: (!imageLoaded || isProcessing) ? '#999' : '#001018',
                fontWeight: 'bold'
              }}
            >
              Step 1: {isProcessing ? 'Scrambling...' : 'Scramble Image'}
            </Button>

            <Button
              variant="contained"
              onClick={onDownloadScrambled}
              startIcon={<Download />}
              disabled={!permDestToSrc0.length}
              sx={{ backgroundColor: '#9c27b0', color: 'white' }}
            >
              Step 2: 🖼️ Download Scrambled Image
            </Button>

            {/* <Button
              variant="outlined"
              onClick={togglePro}
              startIcon={<Settings />}
              sx={{ borderColor: '#666', color: '#e0e0e0' }}
            >
              {isPro ? "Switch to Free (show ads)" : "Simulate Pro (no ads)"}
            </Button> */}

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

          {/* Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ mb: 2, p: 1, backgroundColor: '#333', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: '#ccc' }}>
                Debug: imageFile={imageFile?.name || 'none'}, imageLoaded={imageLoaded.toString()},
                canScramble={imageLoaded && !isProcessing}
              </Typography>
            </Box>
          )}

          {/* Image Comparison */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
            <Grid container spacing={3}>
              {/* Original Image */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Original Image
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
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Original"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        borderRadius: '8px'
                      }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Select an image to preview
                    </Typography>
                  )}

                </Box>
                {imageLoaded && (
                  <Typography variant="caption" sx={{ color: '#4caf50', mt: 1, display: 'block' }}>
                    Image loaded: {imageRef.current?.naturalWidth}×{imageRef.current?.naturalHeight}px
                  </Typography>
                )}
              </Grid>

              {/* Scrambled Canvas */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Scrambled Image Preview
                </Typography>
                <Box sx={{
                  minHeight: '200px',
                  backgroundColor: '#0b1020',
                  border: '1px dashed #666',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <canvas
                    ref={canvasRef}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '8px'
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Hidden watermark canvas */}
          <canvas ref={watermarkCanvasRef} style={{ display: 'none' }} />

          {/* Hidden image element for loading */}
          <img
            ref={imageRef}
            style={{ display: 'none' }}
            alt="Hidden original for processing"
          />

          {/* Key Section */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Un-Scramble Key
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={base64Key}
              placeholder="Your unscramble key will appear here after scrambling..."
              InputProps={{
                readOnly: true,
                sx: {
                  fontFamily: 'monospace',
                  backgroundColor: '#353535',
                  color: 'white'
                }
              }}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Button
                variant="contained"
                onClick={onDownloadKey}
                startIcon={<Download />}
                disabled={!base64Key}
                sx={{ backgroundColor: '#22d3ee', color: '#001018' }}
              >
                📥 Download Key
              </Button>

              <Button
                variant="outlined"
                onClick={onCopyKey}
                startIcon={<ContentCopy />}
                disabled={!base64Key}
                sx={{ borderColor: '#666', color: '#e0e0e0' }}
              >
                📋 Copy Key
              </Button>

              <Button
                variant="contained"
                onClick={() => window.open("https://key-ching.com/register", "_blank")}
                sx={{
                  backgroundColor: 'gold',
                  color: 'green',
                  fontWeight: 'bold',
                  ml: 'auto'
                }}
              >
                $ Sell Your Keys $
              </Button>
            </Box>

            <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 2 }}>
              Save this key to unscramble your image later!
            </Typography>

            <Alert severity="info" sx={{ backgroundColor: '#1976d2', color: 'white' }}>
              You can sell your unscramble keys on{' '}
              <strong
                onClick={() => window.open("https://key-ching.com/info", "_blank")}
                style={{
                  background: "gold",
                  color: "green",
                  padding: '2px 4px',
                  borderRadius: 3,
                  cursor: "pointer"
                }}
              >
                Key-Ching
              </strong>
              , a marketplace for codes/keys/passwords. Unscrambling images is challenging without the key,
              making it perfect for monetizing access to your visual content.
            </Alert>
          </Box>
        </CardContent>
      </Card>

      {/* Info section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
        <Typography variant="body2" color="black">
          💡 Upload an image, scramble it via tile-shifting with watermark and metadata header,
          save the unscrambling algorithm key, and export the result. The scrambled image includes
          a 64px black header with scrambling details and unscrambling instructions.
        </Typography>
      </Paper>

      {/* Processing Modal */}
      {modalShown && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Card sx={{ p: 4, backgroundColor: '#424242', color: 'white', maxWidth: 400 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              🖼️ Processing Your Image...
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: '#e0e0e0' }}>
              Your scrambled image is being generated. Please wait while we prepare your download.
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: '#22d3ee' }}>
              {isPro ? "Pro: no wait" : timerText}
            </Typography>

            {/* display ad  */}
            {/* <AdComponent /> */}

            <Button
              variant="contained"
              onClick={onCloseModal}
              disabled={!isPro && !modalReady}
              fullWidth
              sx={{
                backgroundColor: (isPro || modalReady) ? '#22d3ee' : '#666',
                color: (isPro || modalReady) ? '#001018' : '#999'
              }}
            >
              {(isPro || modalReady) ? 'Continue' : 'Please wait...'}
            </Button>
          </Card>
        </Box>
      )}

      {showCreditModal && (
        /* Credit Confirmation Modal */
        <CreditConfirmationModal
          open={showCreditModal}
          onClose={() => setShowCreditModal(false)}
          onConfirm={handleCreditConfirm}
          mediaType="photo"
          description="scramble photo (lite)"
          
          scrambleLevel={scrambleLevel}
          currentCredits={userCredits}
          fileName={selectedFile?.name || ''}
          isProcessing={isProcessing}
          file={selectedFile}
          fileDetails={{
            type: 'image',
            size: selectedFile?.size || 0,
            name: selectedFile?.name || '',
            horizontal: imageRef.current?.naturalWidth || 0,
            vertical: imageRef.current?.naturalHeight || 0
          }}
          user={userData}
          actionType="scramble-photo"
          actionDescription="free photo scrambling"
        />
      )}
    </Container>
  );
};

// export default ScramblerPhotos;
