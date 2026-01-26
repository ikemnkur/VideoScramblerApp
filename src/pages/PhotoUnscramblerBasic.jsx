// UnscramblerPhotos.jsx — Photo Unscrambler React Component
// Unscrambles photos that were scrambled with the photo scrambler
// Uses the same algorithm but works with images instead of videos

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
  LinearProgress
} from '@mui/material';
import {
  PhotoCamera,
  Upload,
  Close,
  LockOpen,
  Visibility,
  Download,
  Key,
  Image as ImageIcon
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import { refundCredits } from '../utils/creditUtils';
import { fetchUserData } from '../utils/fetchUserData';
import api from '../api/client';

export default function PhotoUnscrambler() {
  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';
  const { success, error } = useToast();

  // 
  // Refs for image and canvas elements

  const [scrambledFilename, setScrambledFilename] = useState('');
  // const [keyCode, setKeyCode] = useState('');

  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));


  const scrambledImageRef = useRef(null);
  const displayScrambledRef = useRef(null);
  const unscrambleCanvasRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const keyFileInputRef = useRef(null);

  // State variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [keyCode, setKeyCode] = useState('');
  const [decodedParams, setDecodedParams] = useState(null);
  const [unscrambleParams, setUnscrambleParams] = useState({
    n: 6, m: 6, permDestToSrc0: []
  });

  const [showModal, setShowModal] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [adCanClose, setAdCanClose] = useState(false);
  const [unscrambledReady, setUnscrambledReady] = useState(false);

  // Rectangles for unscrambling
  const [rectsDest, setRectsDest] = useState([]);
  const [rectsSrcFromShuffled, setRectsSrcFromShuffled] = useState([]);
  const [srcToDest, setSrcToDest] = useState([]);

  const [showCreditModal, setShowCreditModal] = useState(false);
  // const [allowLeakChecking, setAllowLeakChecking] = useState(false);
  const [allowScrambling, setAllowScrambling] = useState(false);
  const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
  const [actionCost, setActionCost] = useState(5); // Cost per unscramble action
  const [scrambleLevel, setScrambleLevel] = useState(6); // Grid size for credit calculation


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

  /* =========================
   Utilities
========================= */
  function gcd(a, b) {
    a = Math.abs(a | 0); b = Math.abs(b | 0);
    while (b !== 0) { const t = a % b; a = b; b = t; }
    return a;
  }

  function mod(n, m) {
    // true mathematical modulo for negatives
    return ((n % m) + m) % m;
  }

  // Mulberry32 PRNG (seeded, fast, deterministic)
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296; // [0,1)
    };
  }

  function clampInt(n, lo, hi) {
    n = Number(n);
    if (!Number.isFinite(n)) n = lo;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }


  /* =========================
   Noise generation (tileable)
   - offsets are integers in [-intensity, +intensity]
   - tile is square: tile x tile
  ========================= */
  function generateNoiseTileOffsets(tileSize, seed, intensity) {
    const rand = mulberry32(seed >>> 0);
    const pxCount = tileSize * tileSize;

    // store offsets per pixel per channel (RGB), Int16 is plenty
    const offsets = new Int16Array(pxCount * 3);

    for (let p = 0; p < pxCount; p++) {
      const base = p * 3;
      // Uniform integer in [-intensity, +intensity]
      offsets[base + 0] = Math.round((rand() * 2 - 1) * intensity);
      offsets[base + 1] = Math.round((rand() * 2 - 1) * intensity);
      offsets[base + 2] = Math.round((rand() * 2 - 1) * intensity);
    }
    return offsets;
  }

  function applyNoiseSubMod256(imageData, tileOffsets, tileSize) {
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    const out = new Uint8ClampedArray(src); // copy

    for (let y = 0; y < h; y++) {
      const ty = y % tileSize;
      for (let x = 0; x < w; x++) {
        const tx = x % tileSize;
        const tileIndex = (ty * tileSize + tx) * 3;
        const i = (y * w + x) * 4;

        out[i + 0] = mod(src[i + 0] - tileOffsets[tileIndex + 0], 256);
        out[i + 1] = mod(src[i + 1] - tileOffsets[tileIndex + 1], 256);
        out[i + 2] = mod(src[i + 2] - tileOffsets[tileIndex + 2], 256);
      }
    }
    return new ImageData(out, w, h);
  }

  // Parse JSON parameters with noise support
  // example: 
  let exampleParams = {
    "scramble": {
      "version": 2,
      "seed": 3268196138,
      "n": 8,
      "m": 8,
      "perm1based": [
        11,
        63,
        30,
        46,
        52,
        58,
        33,
        8,
        38,
        28,
        61,
        49,
        22,
        5,
        4,
        7,
        10,
        64,
        55,
        14,
        12,
        18,
        41,
        35,
        59,
        20,
        29,
        51,
        44,
        48,
        31,
        54,
        53,
        56,
        34,
        13,
        60,
        16,
        36,
        19,
        21,
        6,
        62,
        43,
        47,
        1,
        9,
        15,
        3,
        26,
        57,
        45,
        25,
        23,
        17,
        37,
        32,
        50,
        24,
        27,
        2,
        40,
        42,
        39
      ],
      "semantics": "Index = destination cell (1-based), value = source cell index (1-based)"
    },
    "noise": {
      "seed": 2004541210,
      "intensity": 56,
      "mode": "add_mod256_tile",
      "prng": "mulberry32"
    },
    "metadata": {
      "username": "ikemnkur",
      "userId": "Unknown",
      "timestamp": "2025-12-28T20:50:29.936Z"
    }
  }

  const jsonToParams = (obj) => {
    // Handle nested structure (with "scramble" key) or flat structure
    const scrambleData = obj.scramble || obj;
    const noiseData = obj.noise || null;
    const metadata = obj.metadata || null;

    const n = Number(scrambleData.n);
    const m = Number(scrambleData.m);
    const seed = Number(scrambleData.seed);
    const version = Number(scrambleData.version || 1);
    let perm = null;

    setScrambleLevel(n >= m ? n : m);

    if (Array.isArray(scrambleData.perm1based)) perm = zeroBased(scrambleData.perm1based);
    else if (Array.isArray(scrambleData.perm0based)) perm = scrambleData.perm0based.slice();

    if (!n || !m || !perm) throw new Error("Invalid params JSON: need n, m, and perm array");
    if (perm.length !== n * m) throw new Error("Permutation length doesn't match n*m");

    const seen = new Set(perm);
    if (seen.size !== perm.length || Math.min(...perm) !== 0 || Math.max(...perm) !== perm.length - 1)
      throw new Error("Permutation must contain each index 0..n*m-1 exactly once");

    const result = {
      n,
      m,
      permDestToSrc0: perm,
      seed,
      version
    };

    // Add noise parameters if present
    if (noiseData) {
      result.noise = {
        seed: Number(noiseData.seed),
        intensity: Number(noiseData.intensity),
        mode: noiseData.mode || 'add_mod256_tile',
        prng: noiseData.prng || 'mulberry32'
      };
    }

    // Add metadata if present
    if (metadata) {
      result.metadata = {
        username: metadata.username || 'Unknown',
        userId: metadata.userId || 'Unknown',
        timestamp: metadata.timestamp || new Date().toISOString()
      };
    }

    return result;
  };

  // ========== EVENT HANDLERS ==========

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
    setScrambledFilename('');
    setKeyCode('');
    setImageLoaded(false);
    setUnscrambledReady(false);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Load image into the hidden image ref for processing
    const img = scrambledImageRef.current;
    if (img) {
      img.onload = () => {
        console.log("Image loaded successfully for unscrambling");
        setImageLoaded(true);

        // Setup canvas
        const canvas = unscrambleCanvasRef.current;
        if (canvas) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }

        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        error("Failed to load the selected image");
        setImageLoaded(false);
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }
  };

  const decodeKeyCode = () => {
    try {
      const json = fromBase64(keyCode);
      setDecodedParams(json);
      localStorage.setItem("keyData", keyData)
      success('Key code decoded successfully!');
    } catch (e) {
      error('Invalid key code: ' + e.message);
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
          localStorage.setItem("keyData", keyData)
          success('🔑 Key file loaded and decoded successfully!');
        } catch (base64Err) {
          // Try direct JSON parse
          const keyData = JSON.parse(text);
          setDecodedParams(keyData);
          localStorage.setItem("keyData", keyData)
          setKeyCode(btoa(text)); // Convert to base64 for consistency
          success('🔑 Key file loaded and decoded successfully!');
        }
      }

      setTimeout(() => {
          const decoded = fromBase64(text.trim());
          const keyData = JSON.parse(decoded);
        if (keyData.type !== "photo") {
          error('The loaded key file is not a valid photo scramble key.');
        } else if (keyData.version !== "basic") {
          error('Use the ' + keyData.version + ' ' + keyData.type + ' scrambler to unscramble this file.');
          alert('The loaded key file will not work with this scrambler version, you must use the ' + keyData.version + ' ' + keyData.type + ' scrambler to unscramble this file.');
        }
      }, 200);
    } catch (err) {
      console.error("Error loading key:", err);
      error('Invalid or corrupted key file. Please check the file format.');
    }
  };

  // Spending Credits to Process Image (media)

  useEffect(() => {
    const fetchUserCredits = async () => {
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

    };

    if (userData?.username) {
      fetchUserCredits();
    }
  }, [userData]);

  const handleCreditConfirm = useCallback((actualCostSpent) => {
    setShowCreditModal(false);
    setAllowScrambling(true);

    // Now you have access to the actual cost that was calculated and spent
    console.log('Credits spent:', actualCostSpent);

    // setActionCost(actualCostSpent);
    // alert("Applying Decoded Params:", decodedParams)

    setTimeout(() => {
      // Additional logic after confirming credits
      applyParameters();
    }, 1000);

  }, []);

  // Refund credits on error using shared utility
  const handleRefundCredits = async () => {
    const result = await refundCredits({
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      credits: actionCost,
      currentCredits: userCredits,
      password: localStorage.getItem('hashedPassword'),
      params: decodedParams
    });

    if (result.success) {
      error(`An error occurred during scrambling. ${result.message}`);
    } else {
      error(`Scrambling failed. ${result.message}`);
    }
  };


  const confirmSpendingCredits = () => {
    // setShowCreditModal(false);
    // setAllowScrambling(true);

    setShowCreditModal(true);

    // const LQ = 2;
    // const SDcharge = 3;
    // const HDcharge = 5;
    // const FHDCharge = 10;

    // let fileDetails = {
    //   type: 'image',
    //   size: selectedFile?.size || 0,
    //   name: selectedFile?.name || '',
    //   horizontal: scrambledImageRef.current?.naturalWidth || 0,
    //   vertical: scrambledImageRef.current?.naturalHeight || 0
    // };

    // // Calculate cost based on photo resolution from fileDetails
    // const width = fileDetails.horizontal;
    // const height = fileDetails.vertical;

    // console.log('Photo Dimensions:', width, 'x', height);
    // console.log('Photo Size:', fileDetails.size, 'bytes');

    // let resolutionCost = LQ;
    // if (width >= 1920 && height >= 1080) {
    //   resolutionCost = FHDCharge;
    // } else if (width >= 1280 && height >= 720) {
    //   resolutionCost = HDcharge;
    // } else if (width >= 854 && height >= 480) {
    //   resolutionCost = SDcharge;
    // } else {
    //   resolutionCost = LQ;
    // }

    // let calculatedCost = Math.ceil(Math.sqrt(resolutionCost + 1) * (1 + fileDetails.size / (1000 * 1000 * 0.5))); // scale by size in MB over 0.5MB

    setActionCost(localStorage.getItem('lastActionCost') || 5); // Default to 5 credits if not set
  };

  const applyParameters = () => {

    // if (!allowScrambling) {
    //   error('You need to confirm credit usage before applying parameters.');
    //   return;
    // }


    try {
      if (!decodedParams) {
        throw new Error('No decoded parameters available');
      }

      // Parse the JSON string if decodedParams is a string
      const parsedParams = typeof decodedParams === 'string' ? JSON.parse(decodedParams) : decodedParams;
      
      // Use jsonToParams to properly extract and validate parameters
      const params = jsonToParams(parsedParams);
      const { n, m, permDestToSrc0, noise, metadata } = params;

      setActionCost(n * m >= 100 ? 15 : n * m >= 64 ? 10 : 5); // Adjust cost based on grid size

      // Store complete params including noise data
      setUnscrambleParams({ n, m, permDestToSrc0, noise, metadata });

      const noiseInfo = noise ? `, noise intensity: ${noise.intensity}` : '';
      success(`Parameters applied: ${n}×${m} grid${noiseInfo}`);

      // Build rectangles and draw preview
      if (imageLoaded) {
        buildUnscrambleRects(n, m, permDestToSrc0);
      }
    } catch (e) {
      handleRefundCredits();
      console.error('Error applying parameters:', e);
      error('Invalid parameters: ' + e.message);
    }
  };

  const buildUnscrambleRects = (n = unscrambleParams.n, m = unscrambleParams.m, perm = unscrambleParams.permDestToSrc0) => {
    const img = scrambledImageRef.current;
    const canvas = unscrambleCanvasRef.current;
    if (!img || !canvas || !imageLoaded) return;

    const destRects = cellRects(canvas.width, canvas.height, n, m);
    const srcRects = cellRects(img.naturalWidth, img.naturalHeight, n, m);
    const inversePerm = inversePermutation(perm);

    setRectsDest(destRects);
    setRectsSrcFromShuffled(srcRects);
    setSrcToDest(inversePerm);

    // Draw the unscrambled preview
    drawUnscrambledImage(img, canvas, destRects, srcRects, inversePerm, n, m);
    removeNoiseFromUnscrambledImage();
    setUnscrambledReady(true);
  };

  const drawUnscrambledImage = useCallback((
    img = scrambledImageRef.current,
    targetCanvas = unscrambleCanvasRef.current,
    destRects = rectsDest,
    srcRects = rectsSrcFromShuffled,
    inversePerm = srcToDest,
    n = unscrambleParams.n,
    m = unscrambleParams.m
  ) => {
    if (!img || !targetCanvas || !img.naturalWidth || !inversePerm.length) return;

    const ctx = targetCanvas.getContext('2d');

    // Set canvas to match scrambled image size
    targetCanvas.width = img.naturalWidth;
    targetCanvas.height = img.naturalHeight;

    // First, draw the entire scrambled image as-is (this includes borders and watermarks)
    ctx.drawImage(img, 0, 0);

    const N = n * m;

    // Calculate the center area to unscramble (excluding 64px border on all sides)
    const border = 64;
    const centerWidth = img.naturalWidth - (border * 2);
    const centerHeight = img.naturalHeight - (border * 2);

    // Recalculate rectangles for the center area only
    const centerSrcRects = cellRects(centerWidth, centerHeight, n, m);
    const centerDestRects = cellRects(centerWidth, centerHeight, n, m);

    // Unscramble only the center area
    for (let origIdx = 0; origIdx < N; origIdx++) {
      const shuffledDestIdx = inversePerm[origIdx];
      const sR = centerSrcRects[shuffledDestIdx];
      const dR = centerDestRects[origIdx];
      if (!sR || !dR) continue;

      // Draw unscrambled pieces in the center area (offset by border)
      ctx.drawImage(
        img,
        sR.x + border, sR.y + border, sR.w, sR.h,  // Source: from center area of scrambled image
        dR.x + border, dR.y + border, dR.w, dR.h   // Destination: to center area, preserving borders
      );
    }

    // Add transparent watermark overlay to indicate unscrambled
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '20px Arial';
    // ctx.fillText('🔓 Unscrambled Video ', 10, canvas.height - 40);
    ctx.fillText(`Unscrambled by: ${userData.username}`, 64, targetCanvas.height / 2 + 15);


  }, [srcToDest, rectsSrcFromShuffled, rectsDest, unscrambleParams]);

  const removeNoiseFromUnscrambledImage = useCallback(() => {
    try {
      const canvas = unscrambleCanvasRef.current;
      if (!canvas) {
        console.warn("Canvas not available for noise removal");
        return;
      }

      // Get noise parameters from decoded params
      const noiseData = unscrambleParams.noise;
      if (!noiseData || !noiseData.seed || noiseData.intensity === undefined) {
        console.log("No noise parameters found, skipping noise removal");
        return;
      }

      const intensity = clampInt(noiseData.intensity, 0, 127);
      if (intensity === 0) {
        console.log("Noise intensity is 0, skipping noise removal");
        return;
      }

      const noiseSeed = Number(noiseData.seed) >>> 0;
      const border = 64;

      console.log("Removing noise with parameters:", { seed: noiseSeed, intensity });

      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Get only the center area (excluding 64px border)
      const centerWidth = canvas.width - (border * 2);
      const centerHeight = canvas.height - (border * 2);

      if (centerWidth <= 0 || centerHeight <= 0) {
        console.warn("Invalid center dimensions after border removal");
        return;
      }

      // Get image data from center area only
      const centerImageData = ctx.getImageData(border, border, centerWidth, centerHeight);

      // Calculate tile size based on center dimensions
      const tile = gcd(centerWidth, centerHeight);
      if (tile <= 0) {
        throw new Error("Invalid tile size computed");
      }

      console.log("Tile size for noise removal:", tile);

      // Regenerate the same tile offsets used during scrambling
      const tileOffsets = generateNoiseTileOffsets(tile, noiseSeed, intensity);

      // Apply reverse noise (subtract mod 256)
      const restoredImageData = applyNoiseSubMod256(centerImageData, tileOffsets, tile);

      // Put the restored (denoise) image data back to center area
      ctx.putImageData(restoredImageData, border, border);

      console.log("Noise removed successfully from center area");
      success("Noise removed from unscrambled image");
    } catch (err) {
      console.error("Error removing noise:", err);
      error("Failed to remove noise: " + err.message);
    }
  }, [unscrambleParams, success, error]);

  const closeAdModal = () => {
    if (!adCanClose) return;
    setShowAdModal(false);
    setShowModal(true);

    // Setup modal canvas
    const modalCanvas = modalCanvasRef.current;
    const img = scrambledImageRef.current;
    if (modalCanvas && img) {
      modalCanvas.width = img.naturalWidth;
      modalCanvas.height = img.naturalHeight;
      drawUnscrambledImage(img, modalCanvas, rectsDest, rectsSrcFromShuffled, srcToDest, unscrambleParams.n, unscrambleParams.m);
    }
  };

  const downloadUnscrambledImage = () => {
    const canvas = modalCanvasRef.current || unscrambleCanvasRef.current;
    if (!canvas) {
      error('No unscrambled image to download');
      return;
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unscrambled_${selectedFile?.name || 'image'}_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        success('Unscrambled image downloaded!');
      }
    }, 'image/png');
  };

  // ========== EFFECTS ==========

  useEffect(() => {
    if (unscrambleParams.n && unscrambleParams.m && unscrambleParams.permDestToSrc0.length && imageLoaded) {
      buildUnscrambleRects();
    }
  }, [unscrambleParams, imageLoaded]);

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <ImageIcon />
          🖼️ Photo Unscrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload a scrambled photo, enter the key code, and restore the original image.
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Format: PNG" size="small" />
          <Chip label="Grid range: 36 - 100 cells" size="small" />
          <Chip label="Quality: Lossless" size="small" />
        </Box>
      </Box>

      {/* Main Unscramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* <LockOpen /> */}
            Unscramble a Photo
          </Typography>

          {/* File Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Upload Scrambled Image
            </Typography>
            <input
              type="file"
              accept="image/*"
              // onChange={handleFileSelect}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="image-upload"
            />
            <label htmlFor="image-upload">
              <Button
                variant="contained"
                component="span"
                startIcon={<PhotoCamera />}
                sx={{ backgroundColor: '#2196f3', color: 'white' }}
              >
                Choose Image File
              </Button>
            </label>
            {selectedFile && (
              <Typography variant="body2" sx={{ mt: 1, color: '#4caf50' }}>
                Selected: {selectedFile.name}
              </Typography>
            )}
            {imageLoaded && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#4caf50' }}>
                Image loaded: {scrambledImageRef.current?.naturalWidth}×{scrambledImageRef.current?.naturalHeight}px
              </Typography>
            )}
          </Box>

          {/* Key Code Input */}
          <Box sx={{ mb: 3 }}>
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
            {/* /> */}

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
                onClick={confirmSpendingCredits}
                startIcon={<LockOpen />}
                sx={{ backgroundColor: '#4caf50', color: 'white' }}
                disabled={!decodedParams || !imageLoaded}
              >
                Step 2: Apply & Unscramble
              </Button>

              {/* <Button
                variant="contained"
                onClick={showFullImage}
                startIcon={<Visibility />}
                sx={{ backgroundColor: '#f57c00', color: 'white' }}
                disabled={!unscrambledReady}
              >
                Step 3: View Full Image
              </Button> */}

              <Button
                variant="outlined"
                onClick={downloadUnscrambledImage}
                startIcon={<Download />}
                sx={{ borderColor: '#22d3ee', color: '#22d3ee' }}
                disabled={!unscrambledReady}
              >
                Step 3: Download Unscrambled Image
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
            {/* {!isPro && ( */}

            {/* )} */}
          </Box>

          {/* Image Comparison */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
            <Grid container spacing={3}>
              {/* Scrambled Image */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Scrambled Image
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

              </Grid>

              {/* Unscrambled Preview */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Unscrambled Image Preview
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
                    ref={unscrambleCanvasRef}
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

          {/* Hidden image for processing */}
          <img ref={scrambledImageRef} style={{ display: 'none' }} alt="Hidden for processing" />
        </CardContent>
      </Card>

      {/* Info section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 4 }}>
        <Typography variant="body2" color="black">
          💡 Upload a scrambled image (with watermark and metadata header), decode your unscramble key,
          and restore the original image. The process reverses the tile-shifting algorithm used during scrambling.
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
          height: { xs: '50vh', md: '360px' },
          bgcolor: '#424242',
          border: '2px solid #666',
          borderRadius: 2,
          p: 3,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Typography variant="h5" sx={{ mb: 2, color: 'white' }}>
            🖼️ Processing Your Image...
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: '#e0e0e0' }}>
            Your unscrambled image is being prepared. Please wait while we process your request.
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

      {/* View Full Image Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1400px',
          maxHeight: '90vh',
          bgcolor: '#424242',
          border: '2px solid #666',
          borderRadius: 2,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ color: 'white' }}>
              🖼️ Unscrambled Image (Full Resolution)
            </Typography>
            <IconButton onClick={() => setShowModal(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>

          <Typography variant="body1" sx={{ mb: 2, color: '#e0e0e0' }}>
            Here is your fully unscrambled image at original resolution. You can download it using the button below.
          </Typography>

          {/* Image Canvas */}
          <Box sx={{
            flexGrow: 1,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0b1020',
            borderRadius: 2,
            overflow: 'auto',
            maxHeight: '70vh'
          }}>
            <canvas
              ref={modalCanvasRef}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: '12px'
              }}
            />
          </Box>

          {/* Download Button */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={downloadUnscrambledImage}
              sx={{ backgroundColor: '#22d3ee', color: '#001018' }}
            >
              Download Full Resolution Image
            </Button>

            <Button
              variant="outlined"
              onClick={() => setShowModal(false)}
              sx={{ borderColor: '#666', color: '#e0e0e0' }}
            >
              Close
            </Button>
          </Box>
        </Box>
      </Modal>

      {showCreditModal && (
        /* Credit Confirmation Modal */
        < CreditConfirmationModal
          open={showCreditModal}
          onClose={() => setShowCreditModal(false)}
          onConfirm={handleCreditConfirm}
          mediaType="photo"
          description="unscramble photo (lite)"

          scrambleLevel={scrambleLevel}
          currentCredits={userCredits}
          fileName={selectedFile?.name || ''}
          file={selectedFile}
          user={userData}
          isProcessing={false}
          fileDetails={{
            type: 'image',
            size: selectedFile?.size || 0,
            name: selectedFile?.name || '',
            horizontal: scrambledImageRef.current?.naturalWidth || 0,
            vertical: scrambledImageRef.current?.naturalHeight || 0
          }}
          actionType="unscramble-photo"
          actionDescription="basic photo unscrambling"
        />

      )}
    </Container>
  );
}