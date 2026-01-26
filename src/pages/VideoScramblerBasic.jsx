// Scrambler.jsx — Video Scrambler React Component with Material-UI
// Matches ScramblerPhotosPro.jsx styling for consistent design
// Maintains all original scrambling functionality

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
  Alert,
  Modal,
  LinearProgress,
  IconButton,
  Slider
} from '@mui/material';
import {
  VideoFile,
  Shuffle,
  Download,
  ContentCopy,
  CloudDownload,
  AutoAwesome,
  Close,
  Movie
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';
import { Navigate, useNavigate } from "react-router-dom";
import { fetchUserData } from "../utils/fetchUserData";
import { refundCredits } from '../utils/creditUtils';

export default function VideoScramblerBasic() {

  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';

  const { success, error } = useToast();

  // =============================
  // REFS
  // =============================
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const adIframeRef = useRef(null);
  const timerIdRef = useRef(null);
  const waitTimeRef = useRef(15); // Track countdown with ref to avoid closure issues

  // =============================
  // STATE
  // =============================

  const [userData] = useState(localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')) : null);
  // const [isPro, setIsPro] = useState(false);
  // console.log("User data in VideoScramblerBasic:", await fetchUserData());

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState("med"); // low|med|high
  const [grid, setGrid] = useState({ n: 5, m: 5 });
  const [seed, setSeed] = useState(() => genRandomSeed());
  const [permDestToSrc0, setPermDestToSrc0] = useState([]);
  const [base64Key, setBase64Key] = useState("");
  const [jsonKey, setJsonKey] = useState("");
  const [params, setParams] = useState("");


  // Recording
  const [isProcessing, setIsProcessing] = useState(false);
  const chunksRef = useRef([]);
  const PRESET_FPS = 30;

  // Ad modal state
  const [modalShown, setModalShown] = useState(false);
  const [modalReady, setModalReady] = useState(false);
  const [timerText, setTimerText] = useState("Please wait...");
  const [recordingFinished, setRecordingFinished] = useState(false);
  const [waitTimeRemaining, setWaitTimeRemaining] = useState(15);

  // Animation
  const [animating, setAnimating] = useState(false);

  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressType, setProgressType] = useState('info'); // 'info' | 'success' | 'error'

  // Credit modal state
  const [showCreditModal, setShowCreditModal] = useState(false);
  // const [allowScrambling, setAllowScrambling] = useState(false);
  const [userCredits, setUserCredits] = useState(100); // Mock credits, replace with actual user data
  const [videoDuration, setVideoDuration] = useState(0);
  const [actionCost, setActionCost] = useState(10); // Cost to scramble a video
  const [scrambleLevel, setScrambleLevel] = useState(1); // Level of scrambling (for credit calculation)



  // =============================
  // UTILITY FUNCTIONS
  // =============================
  function genRandomSeed() {
    if (window.crypto?.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] >>> 0;
    }
    return (Math.floor(Math.random() * 2 ** 32) >>> 0);
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededPermutation(size, seed) {
    const rand = mulberry32(seed >>> 0);
    const srcs = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [srcs[i], srcs[j]] = [srcs[j], srcs[i]];
    }
    return srcs;
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
  // DRAW SCRAMBLED FRAME
  // =============================
  const drawScrambledFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const ctx = canvas.getContext("2d");
    const N = grid.n * grid.m;
    if (!permDestToSrc0 || permDestToSrc0.length !== N) return;

    // Round up to nearest multiple of grid size
    const paddedWidth = Math.floor(video.videoWidth / grid.m) * grid.m;
    const paddedHeight = Math.floor(video.videoHeight / grid.n) * grid.n;

    // if the video dimension are above HD reduce canvas size to fit within 1280x720 while maintaining aspect ratio
    let finalWidth = paddedWidth;
    let finalHeight = paddedHeight;

    const maxWidth = Math.floor(1280 / grid.m) * grid.m;
    const maxHeight = Math.floor(720 / grid.n) * grid.n;

    const aspectRatio = paddedWidth / paddedHeight;

    if (paddedWidth > maxWidth || paddedHeight > maxHeight) {
      if (aspectRatio > maxWidth / maxHeight) {
        finalWidth = maxWidth;
        finalHeight = Math.round(maxWidth / aspectRatio);
      } else {
        finalHeight = maxHeight;
        finalWidth = Math.round(maxHeight * aspectRatio);
      }
    }

    canvas.width = finalWidth;
    canvas.height = finalHeight + 32;

    // ctx.clearRect(0, 0, canvas.width, canvas.height);
    // const srcRects = cellRects(paddedWidth, paddedHeight, grid.n, grid.m);
    // const destRects = cellRects(canvas.width, canvas.height, grid.n, grid.m);

    // for (let destIdx = 0; destIdx < N; destIdx++) {
    //   const srcIdx = permDestToSrc0[destIdx];
    //   const sR = srcRects[srcIdx];
    //   const dR = destRects[destIdx];
    //   if (!sR || !dR) continue;
    //   ctx.drawImage(video, sR.x, sR.y, sR.w, sR.h, dR.x, dR.y, dR.w, dR.h);
    // }

    // let voffset = 32

    // // Add black rectangle bar at bottom (64px height)
    // ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    // ctx.fillRect(0, canvas.height - voffset, canvas.width, voffset);

    // // Add watermark overlay text on the black bar
    // ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    // ctx.font = 'bold 20px Arial';
    // // ctx.fillText('🔓 Scrambled Video', 10, canvas.height - 40);
    // ctx.fillText(`Scrambled by: ${userData.username}`, 10, canvas.height - 10);
    // ctx.fillText(`VideoScrambler🔓`, canvas.width - 180, canvas.height - 10);

    //  finalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const srcRects = cellRects(paddedWidth, paddedHeight, grid.n, grid.m);
    const destRects = cellRects(canvas.width, finalHeight, grid.n, grid.m);

    for (let destIdx = 0; destIdx < N; destIdx++) {
      const srcIdx = permDestToSrc0[destIdx];
      const sR = srcRects[srcIdx];
      const dR = destRects[destIdx];
      if (!sR || !dR) continue;
      ctx.drawImage(video, sR.x, sR.y, sR.w, sR.h, dR.x, dR.y, dR.w, dR.h);
    }

    let voffset = 32

    // Add black rectangle bar at bottom (64px height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, canvas.height - voffset, canvas.width, voffset);

    // Add watermark overlay text on the black bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 24px Arial';
    // ctx.fillText('🔓 Scrambled Video', 10, canvas.height - 40);
    ctx.fillText(`Scrambled by: ${userData.username}`, 10, canvas.height);
    ctx.fillText(`VideoScrambler🔓`, canvas.width - 220, canvas.height);

  }, [grid, permDestToSrc0]);


  // =============================
  // EFFECTS
  // =============================
  useEffect(() => {
    if (selectedLevel === "low") setGrid({ n: 5, m: 5 });
    else if (selectedLevel === "med") setGrid({ n: 7, m: 7 });
    else if (selectedLevel === "high") setGrid({ n: 9, m: 9 });
  }, [selectedLevel]);

  const updateRects = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 0;
    canvas.height = video.videoHeight || 0;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const onLoaded = () => updateRects();
    video.addEventListener("loadedmetadata", onLoaded);
    return () => video.removeEventListener("loadedmetadata", onLoaded);
  }, [updateRects]);


  // --------------USE EFFECTS CONTINUED----------------`

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
  }, []);



  // Animate while playing
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (!animating) return;
      const video = videoRef.current;
      if (video && !video.paused && !video.ended) drawScrambledFrame();
      raf = requestAnimationFrame(loop);
    };
    if (animating) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animating, drawScrambledFrame]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setAnimating(true);
    const onPause = () => setAnimating(false);
    const onEnded = () => setAnimating(false);
    const onSeeked = () => {
      if (!video.paused) drawScrambledFrame();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [drawScrambledFrame]);





  // =============================
  // EVENT HANDLERS
  // =============================
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      error("Please select a valid video file");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    // if (videoRef.current) {
    // videoRef.current.src = url;
    // }

    // play video muted to allow autoplay
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.src = url;
      }

      if (videoRef.current) {
        videoRef.current.play();
        // videoRef.current.muted = true;
      }
    }, 100);

    success("Video file loaded successfully!");

  };

  const onGenerate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.src) {
      error("Please select a video file first");
      return;
    }

    setIsProcessing(true);
    // display video durration
    console.log("Video duration (s):", video.duration);
    setVideoDuration(Math.ceil(video.duration));

    // Determine grid size based on selected level
    // setScrambleLevel(grid.n >= grid.m ? grid.n : grid.m);
    console.log("Determined scramble level:", scrambleLevel);

    // Show credit confirmation modal before scrambling
    setShowCreditModal(true);
  }, [error]);


  const handleCreditConfirm = useCallback((actualCostSpent) => {
    try {
      setShowCreditModal(false);
      // allowScrambling(true);

      // Now you have access to the actual cost that was calculated and spent

      setActionCost(localStorage.getItem('lastActionCost') || 0);

      console.log("File selected:", selectedFile);

      // Perform the scrambling
      const newSeed = genRandomSeed();
      setSeed(newSeed);

      const N = grid.n * grid.m;
      const perm = seededPermutation(N, newSeed);
      setPermDestToSrc0(perm);

      const params = {
        input: selectedFile.name,
        output: `scrambled_${selectedFile.name}`,
        seed: newSeed,
        mode: 'scramble',
      
      
        m: grid.m,
        n: grid.n,
        // percentage: scramblingPercentage,
        // maxHueShift,
        // maxIntensityShift,
        timestamp: Date.now(),
        // username: userData.username || 'Anonymous',
        // userId: userData.userId || 'Unknown',

        creator: {
          username: userData.username || 'Anonymous',
          userId: userData.userId || 'Unknown',
          timestamp: new Date().toISOString()
        },
        metadata: {
          videoName: selectedFile.name,
          size: selectedFile.size,
          fileType: selectedFile.type,
          dimensions: {
            width: videoRef.current?.videoWidth || 0,
            height: videoRef.current?.videoHeight || 0
          },
          duration: videoRef.current?.duration || 0,
          fps: videoRef.current ? 30 : 0
        },
        type: "video",
        version: "Basic",
        perm1based: oneBased(perm),
        semantics: "Index = destination cell (1-based), value = source cell index (1-based)", 
      };


      // const obj = paramsToJSON(newSeed, grid.n, grid.m, perm, userData.username || 'Anonymous', userData.userId || 'Unknown', new Date().toISOString());
      const pretty = JSON.stringify(params, null, 2);
      setParams(pretty);
      setJsonKey(pretty);
      setBase64Key(toBase64(pretty));

      // Draw first frame
      setTimeout(() => drawScrambledFrame(), 100);

      // Deduct credits
      setUserCredits(prev => prev - actionCost);

      // Show success message
      success(`Video scrambled successfully! ${actionCost} credits used.`);

      // Play video muted to allow autoplay
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play();
          // videoRef.current.muted = true;
        }
      }, 100);

    } catch (error) {
      handleRefundCredits();
    }

  }, [grid, drawScrambledFrame, success, actionCost]);


  // Refund credits on error using shared utility
  const handleRefundCredits = async () => {
    const result = await refundCredits({
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      credits: actionCost,
      currentCredits: userCredits,
      password: localStorage.getItem('hashedPassword'),
      params: params,
      action: 'scramble_video_basic'
    });

    if (result.success) {
      error(`An error occurred during scrambling. ${result.message}`);
    } else {
      error(`Scrambling failed. ${result.message}`);
    }
  };




  const markRecordingFinished = useCallback(() => {
    setRecordingFinished(true);
    setWaitTimeRemaining(0);
    // startAdModalCloseoutTimer();
  }, []);

  // =============================
  // RECORD SCRAMBLED VIDEO (Frame-by-Frame)
  // =============================
  const recordScrambledVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    if (!video.src) {
      error("Please select a video file first");
      return;
    }

    if (!permDestToSrc0 || permDestToSrc0.length === 0) {
      error("Please scramble the video first");
      return;
    }

    // Show progress modal
    setShowProgressModal(true);
    setProgressMessage('Preparing scrambled frames...');
    setProgressPercent(0);
    setProgressType('info');
    setIsProcessing(true);

    // Give React time to render the modal
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Pause video and reset to start
      video.pause();
      video.currentTime = 0;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        if (video.readyState >= 2) {
          resolve();
        } else {
          const onCanPlay = () => {
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            resolve();
          };
          const onError = (e) => {
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            reject(e);
          };
          video.addEventListener('canplay', onCanPlay);
          video.addEventListener('error', onError);
        }
      });

      const fps = PRESET_FPS;
      const duration = video.duration;
      const totalFrames = Math.floor(duration * fps);
      setProgressMessage(`Video loaded: ${totalFrames} frames at ${fps} fps`);

      // Phase 1: extract scrambled frames into memory
      const scrambledFrames = [];

      // Helper function to seek and wait
      const seekToTime = (time) => {
        return new Promise((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);

          // If already at this time (or very close), resolve immediately
          if (Math.abs(video.currentTime - time) < 0.001) {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          } else {
            video.currentTime = time;
          }
        });
      };

      // Process frames one by one (no MediaRecorder yet)
      for (let i = 0; i < totalFrames; i++) {
        // Seek to the frame position
        await seekToTime(i / fps);

        // Draw the scrambled frame
        drawScrambledFrame();

        // Capture the current canvas frame as an image
        scrambledFrames.push(canvas.toDataURL('image/webp', 0.95));

        // Update progress every 10 frames or on last frame
        if (i % 10 === 0 || i === totalFrames - 1) {
          const percent = Math.round((i / totalFrames) * 100);
          setProgressPercent(percent);
          setProgressMessage(`Preparing frames: ${i + 1}/${totalFrames} (${percent}%)`);
          // Allow React to update UI
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Phase 2: encode video from precomputed frames with MediaRecorder
      setProgressMessage('Encoding video from frames...');
      setProgressPercent(0);

      // Use a separate canvas for recording
      const recCanvas = document.createElement('canvas');
      recCanvas.width = canvas.width;
      recCanvas.height = canvas.height;
      const recCtx = recCanvas.getContext('2d');

      const stream = recCanvas.captureStream(fps);
      chunksRef.current = [];

      // Choose a mimeType that the browser supports
      let mediaRecorder;
      const preferred = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm;codecs=vp8,opus",
        "video/webm"
      ];
      let opts = { videoBitsPerSecond: 5000000 };

      for (const mt of preferred) {
        try {
          if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mt)) {
            opts.mimeType = mt;
            break;
          }
        } catch (e) {
          // ignore and try next
        }
      }

      try {
        mediaRecorder = new MediaRecorder(stream, opts);
      } catch (err) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };

      const recordingComplete = new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          resolve(blob);
        };
      });

      mediaRecorder.start();

      // Draw each precomputed frame at the target FPS
      const totalOutFrames = scrambledFrames.length;
      for (let i = 0; i < totalOutFrames; i++) {
        const frameImg = new Image();
        frameImg.src = scrambledFrames[i];
        await new Promise((resolve) => {
          frameImg.onload = resolve;
          frameImg.onerror = resolve; // skip on error but don't hang
        });

        recCtx.clearRect(0, 0, recCanvas.width, recCanvas.height);
        recCtx.drawImage(frameImg, 0, 0, recCanvas.width, recCanvas.height);

        if (i % 10 === 0 || i === totalOutFrames - 1) {
          const percent = Math.round((i / totalOutFrames) * 100);
          setProgressPercent(percent);
          setProgressMessage(`Encoding video: ${i + 1}/${totalOutFrames} frames (${percent}%)`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        // Wait for frame duration to control encoded FPS
        await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
      }

      mediaRecorder.stop();
      const blob = await recordingComplete;

      // Download the video
      const baseName = selectedFile?.name
        ? selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[^\w\-. ]+/g, '').replace(/\s+/g, '_')
        : 'video';
      download(`${baseName}_scrambled.webm`, blob);

      // Update UI
      setProgressPercent(100);
      setProgressMessage('Video encoded successfully! Download started.');
      setProgressType('success');
      chunksRef.current = [];
      markRecordingFinished();
      setRecordingFinished(true);
      success("Scrambled video downloaded!");

      // Close modal after a short delay
      setTimeout(() => {
        setShowProgressModal(false);
        setIsProcessing(false);
      }, 2000);

    } catch (err) {
      console.error("Recording error:", err);
      setProgressMessage(`Error: ${err.message}`);
      setProgressType('error');
      error("Failed to encode video. Please try again.");
      setIsProcessing(false);

      setTimeout(() => {
        setShowProgressModal(false);
      }, 3000);
    }
  }, [permDestToSrc0, markRecordingFinished, error, success, drawScrambledFrame, selectedFile]);




  // =============================
  // COPY & DOWNLOAD KEY
  // =============================
  const onCopyKey = useCallback(async () => {
    if (!base64Key) {
      error("Please scramble a video first to generate a key");
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
      error("Please scramble a video first to generate a key");
      return;
    }
    const blob = new Blob([base64Key], { type: "text/plain" });
    const baseName = selectedFile?.name
      ? selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[^\w\-. ]+/g, '').replace(/\s+/g, '_')
      : 'unscramble_key';
    download(`${baseName}_unscramble_key.txt`, blob);
    success("Key downloaded!");
  }, [base64Key, error, success]);

  const regenerateSeed = () => {
    setSeed(genRandomSeed());
    success("New seed generated!");
  };

  // =============================
  // RENDER
  // =============================
  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <AutoAwesome />
          🎞️ Video Scrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Scramble your videos with tile-based encryption
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Export: WebM" size="small" color="success" />
          <Chip label="Quality: 30 FPS" size="small" />
          <Chip label={"Basic Plan"} size="small" color={"primary"} />
        </Box>
      </Box>

      {/* Main Scramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Shuffle />
            Scramble Video
          </Typography>

          {/* File Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Select Video File
            </Typography>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="video-upload-scramble"
              ref={fileRef}
            />
            <label htmlFor="video-upload-scramble">
              <Button
                variant="contained"
                component="span"
                startIcon={<VideoFile />}
                sx={{ backgroundColor: '#2196f3', color: 'white', mb: 1 }}
              >
                Choose Video File
              </Button>
            </label>
            {selectedFile && (
              <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                ✓ Selected: {selectedFile.name}
              </Typography>
            )}
          </Box>

          {/* Scramble Level Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>
              Scrambling Level
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant={selectedLevel === "low" ? "contained" : "outlined"}
                  onClick={() => { setSelectedLevel("low"); setScrambleLevel(5); }}
                  sx={{
                    backgroundColor: selectedLevel === "low" ? '#22d3ee' : 'transparent',
                    color: selectedLevel === "low" ? '#001018' : '#e0e0e0',
                    borderColor: '#666',
                    '&:hover': { borderColor: '#22d3ee' }
                  }}
                >
                  Low (5×5)
                </Button>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant={selectedLevel === "med" ? "contained" : "outlined"}
                  onClick={() => { setSelectedLevel("med"); setScrambleLevel(7); }}
                  sx={{
                    backgroundColor: selectedLevel === "med" ? '#22d3ee' : 'transparent',
                    color: selectedLevel === "med" ? '#001018' : '#e0e0e0',
                    borderColor: '#666',
                    '&:hover': { borderColor: '#22d3ee' }
                  }}
                >
                  Medium (7×7)
                </Button>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant={selectedLevel === "high" ? "contained" : "outlined"}
                  onClick={() => { setSelectedLevel("high"); setScrambleLevel(9); }}
                  sx={{
                    backgroundColor: selectedLevel === "high" ? '#22d3ee' : 'transparent',
                    color: selectedLevel === "high" ? '#001018' : '#e0e0e0',
                    borderColor: '#666',
                    '&:hover': { borderColor: '#22d3ee' }
                  }}
                >
                  High (9×9)
                </Button>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 2, backgroundColor: '#1976d2', color: 'white' }}>
              <strong>Grid Size: {grid.n} × {grid.m}</strong> - Your video will be split into {grid.n * grid.m} tiles
            </Alert>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button
              variant="contained"
              onClick={onGenerate}
              startIcon={<Shuffle />}
              disabled={!selectedFile}
              sx={{
                backgroundColor: !selectedFile ? '#666' : '#22d3ee',
                color: !selectedFile ? '#999' : '#001018',
                fontWeight: 'bold'
              }}
            >
              Scramble Video
            </Button>

            <Button
              variant="contained"
              onClick={recordScrambledVideo}
              startIcon={<CloudDownload />}
              disabled={!permDestToSrc0 || permDestToSrc0.length === 0}
              sx={{ backgroundColor: '#9c27b0', color: 'white' }}
            >
              {'Download Scrambled Video'}
            </Button>

            {(
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
            )}
          </Box>

          {/* Video Comparison */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
            <Grid container spacing={3}>
              {/* Original Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Original Video
                </Typography>
                <Box sx={{
                  minHeight: '200px',
                  backgroundColor: '#0b1020',
                  border: '1px dashed #666',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <video
                    ref={videoRef}
                    controls
                    style={{
                      width: '100%',
                      minHeight: '180px',
                      backgroundColor: '#0b1020',
                      display: selectedFile ? 'block' : 'none'
                    }}
                  />
                  {!selectedFile && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        Select a video to preview
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>

              {/* Scrambled Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Scrambled Preview
                </Typography>
                <Box sx={{
                  minHeight: '200px',
                  backgroundColor: '#0b1020',
                  border: '1px dashed #666',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {permDestToSrc0.length > 0 ? (
                    <canvas
                      ref={canvasRef}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1020'
                      }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        Scrambled preview will appear here
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Key Section */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Unscramble Key
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

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={onDownloadKey}
                startIcon={<Download />}
                disabled={!base64Key}
                sx={{ backgroundColor: '#22d3ee', color: '#001018' }}
              >
                Download Key
              </Button>

              <Button
                variant="outlined"
                onClick={onCopyKey}
                startIcon={<ContentCopy />}
                disabled={!base64Key}
                sx={{ borderColor: '#666', color: '#e0e0e0' }}
              >
                Copy Key
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Info Section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 2 }}>
        <Typography variant="body2" color="black">
          💡 <strong>How it works:</strong> Upload a video (≤60s recommended), choose a scrambling level,
          and scramble it via tile-shifting. Save the unscrambling key and export the scrambled video.
          Share the video publicly and the key privately to control access.
        </Typography>
      </Paper>

      {/* Help Section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
        <Typography variant="body2" color="black">
          🔑 <strong>Pro Tip:</strong> Higher scrambling levels (7×7) provide better security but take longer to process.
          Medium (5×5) offers a good balance between security and performance for most use cases.
        </Typography>
      </Paper>



      {/* Progress Modal */}
      <Modal
        open={showProgressModal}
        onClose={() => { }}
        aria-labelledby="progress-modal-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          bgcolor: '#424242',
          borderRadius: 2,
          boxShadow: 24,
          p: 4,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Movie sx={{ color: progressType === 'success' ? '#4caf50' : progressType === 'error' ? '#f44336' : '#2196f3' }} />
            <Typography id="progress-modal-title" variant="h6" sx={{ color: 'white' }}>
              {progressType === 'success' ? 'Encoding Complete' : progressType === 'error' ? 'Encoding Failed' : 'Encoding Video'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{
                height: 10,
                borderRadius: 5,
                backgroundColor: '#666',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: progressType === 'success' ? '#4caf50' : progressType === 'error' ? '#f44336' : '#22d3ee',
                }
              }}
            />
          </Box>

          <Typography variant="body2" sx={{ color: '#e0e0e0', textAlign: 'center' }}>
            {progressMessage}
          </Typography>

          {progressType === 'success' && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                variant="contained"
                onClick={() => setShowProgressModal(false)}
                sx={{ backgroundColor: '#4caf50', color: 'white' }}
              >
                Close
              </Button>
            </Box>
          )}

          {progressType === 'error' && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                variant="contained"
                onClick={() => setShowProgressModal(false)}
                sx={{ backgroundColor: '#f44336', color: 'white' }}
              >
                Close
              </Button>
            </Box>
          )}
        </Box>
      </Modal>

      {/* Credit Confirmation Modal */}
      {showCreditModal &&
        <CreditConfirmationModal
          open={showCreditModal}
          onClick={() => {
            setShowCreditModal(true);
          }}
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
            horizontal: videoRef.current?.videoWidth || 0,
            vertical: videoRef.current?.videoHeight || 0,
            duration: videoDuration
          }}
          user={userData}
          isProcessing={false}
          actionType="scramble-video"
          actionDescription="basic video scrambling"
        />}
    </Container>
  );
}