// AudioUnscrambler.jsx — Audio Unscrambler (React)
// Audio unscrambling with shuffle and noise operations
// Upload scrambled audio, apply segment unshuffling and/or noise removal
// Download unscrambled audio and recovered key

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
  Divider
} from '@mui/material';
import {
  AudioFile,
  Upload,
  Shuffle,
  Download,
  Key,
  Lock,
  LockOpen,
  VolumeUp,
  VpnKey
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

export default function AudioUnscrambler() {
  const { success, error } = useToast();

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';
  const Flask_API_URL = import.meta.env.VITE_API_PY_SERVER_URL || 'http://localhost:5000';

  // =============================
  // STATE & REFS
  // =============================
  const audioFileInputRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const canvasRef = useRef(null);

  const processedAudioPlayerRef = useRef(null);
  const processedCanvasRef = useRef(null);

  const unscrambledAudioPlayerRef = useRef(null);
  const unscrambledCanvasRef = useRef(null);
  const keyFileInputRef = useRef(null);

  const [audioContext] = useState(() => new (window.AudioContext || window.webkitAudioContext)());
  const VIEW_SPAN = 10; // 10 seconds viewable area

  const [audioBuffer, setAudioBuffer] = useState(null);
  const [finalAudioBuffer, setFinalAudioBuffer] = useState(null);
  const [recoveredAudioBuffer, setRecoveredAudioBuffer] = useState(null);
  const [stegoAudioBuffer, setStegoAudioBuffer] = useState(null);

  const [download_url, setDownloadUrl] = useState(null);

  const [scrambledAudioBuffer, setScrambledAudioBuffer] = useState(null);

  const [generatedNoise, setGeneratedNoise] = useState(null);
  const [scramblingParameters, setScramblingParameters] = useState(null);
  const [decodedParams, setDecodedParams] = useState(null);
  const [loadedKeyData, setLoadedKeyData] = useState(null);
  const [keyCode, setKeyCode] = useState('');

  const [shuffleSeed, setShuffleSeed] = useState('12345');
  const [noiseSeed, setNoiseSeed] = useState('54321');
  const [segmentSize, setSegmentSize] = useState('2');
  const [padding, setPadding] = useState('0.5');
  const [noiseLevel, setNoiseLevel] = useState('0.3');

  const [filename, setFilename] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [sampleRate, setSampleRate] = useState(48000);
  const [numberOfChannels, setNumberOfChannels] = useState(2);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  // const actionCost = 3;
  const [actionCost, setActionCost] = useState(3);
  const [scrambleLevel, setScrambleLevel] = useState(1);

  const [userData] = useState(JSON.parse(localStorage.getItem("userdata")));

  const [creatorInfo, setCreatorInfo] = useState({
    username: 'Anonymous',
    userId: 'Unknown',
    time: new Date(Date.now() - 7 * Math.random() * 24 * 1000 * 3600).toISOString() // 7day - 24 hours ago, for testing
  });

  const [metadata, setMetadata] = useState({
    filename: "untitled.wav",
    size: 2048000,
    fileType: ".wav",
    duration: 60,
    sampleRate: 48000,
    channels: 2
  });


  // const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

  // =============================
  // FETCH USER CREDITS
  // =============================
  useEffect(() => {
    const fetchCredits = async () => {
      if (!userData?.username) return;

      try {
        // JWT token in the Authorization header automatically authenticates the user
        // No need to send password (it's not stored in localStorage anyway)
        const { data } = await api.post(`/api/wallet/balance/${userData.username}`, {
          email: userData.email
        });
        setUserCredits(data?.balance ?? 0);
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
        setUserCredits(0);
      }

    };

    fetchCredits();
  }, [userData]);

  // =============================
  // HANDLE CREDIT REFUND
  // =============================

  const handleRefundCredits = async () => {
    const result = await refundCredits({
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      credits: actionCost,
      currentCredits: userCredits,
      password: localStorage.getItem('passwordtxt'),
      action: 'scramble_photo_pro',
      params: {
        scrambleLevel: scrambleLevel,
        grid: { rows, cols },
        seed: seed,
        algorithm: algorithm,
        percentage: scramblingPercentage
      }
    });

    if (result.success) {
      error(`An error occurred during scrambling. ${result.message}`);
    } else {
      error(`Scrambling failed. ${result.message}`);
    }
  };

  // =============================
  // UTILITY FUNCTIONS
  // =============================
  const generateRandomSeed = () => Math.floor(Math.random() * 1000000000);

  const seededRandom = (seed) => {
    let value = seed;
    return function () {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  };

  const seededShuffle = (array, seed) => {
    const rng = seededRandom(seed);
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const xorEncrypt = (text, key) => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  };

  // const encryptKeyData = (keyObject) => {
  //   const jsonStr = JSON.stringify(keyObject);
  //   const encryptionKey = "AudioProtectionKey2025";
  //   const encrypted = xorEncrypt(jsonStr, encryptionKey);
  //   return btoa(encrypted);
  // };

  const decryptKeyData = (encodedData) => {
    try {
      const encrypted = atob(encodedData);
      const encryptionKey = "AudioProtectionKey2025";
      const jsonStr = xorEncrypt(encrypted, encryptionKey);
      console.log("Decrypted key data:", jsonStr);

      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('Decryption error:', err);
      throw new Error('Invalid or corrupted key file');
    }
  };

  // =============================
  // AUDIO PROCESSING FUNCTIONS
  // =============================
  const generateMultiFrequencyNoise = (length, noiseLevel, seed) => {
    const rng1 = seededRandom(seed);
    const rng2 = seededRandom(seed * 2);
    const rng3 = seededRandom(seed * 3);

    const noiseWaveform = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const highFreq = (rng1() * 2 - 1) * noiseLevel * 0.4;
      const midFreq = (i % 4 === 0) ? (rng2() * 2 - 1) * noiseLevel * 0.4 : 0;
      const lowFreq = (i % 16 === 0) ? (rng3() * 2 - 1) * noiseLevel * 0.3 : 0;

      noiseWaveform[i] = highFreq + midFreq + lowFreq;

      if (i > 0 && midFreq === 0 && i % 4 !== 0) {
        noiseWaveform[i] += noiseWaveform[i - 1] * 0.7;
      }
    }

    return noiseWaveform;
  };

  const createAudioBufferFromData = (data, sr, numChannels) => {
    const buffer = audioContext.createBuffer(numChannels, data.length, sr);
    for (let channel = 0; channel < numChannels; channel++) {
      buffer.getChannelData(channel).set(data);
    }
    return buffer;
  };

  // const applyNoise = (originalBuffer, noiseData) => {
  //   const originalData = originalBuffer.getChannelData(0);
  //   const combinedData = new Float32Array(originalData.length);

  //   for (let i = 0; i < originalData.length; i++) {
  //     const noiseIndex = i % noiseData.length;
  //     combinedData[i] = Math.max(-1, Math.min(1, originalData[i] + noiseData[noiseIndex]));
  //   }

  //   return createAudioBufferFromData(combinedData, originalBuffer.sampleRate, originalBuffer.numberOfChannels);
  // };

  const reverseNoise = (noisyBuffer, noiseData) => {
    const noisyData = noisyBuffer.getChannelData(0);
    const recoveredData = new Float32Array(noisyData.length);

    for (let i = 0; i < noisyData.length; i++) {
      const noiseIndex = i % noiseData.length;
      recoveredData[i] = Math.max(-1, Math.min(1, noisyData[i] - noiseData[noiseIndex]));
    }

    return createAudioBufferFromData(recoveredData, noisyBuffer.sampleRate, noisyBuffer.numberOfChannels);
  };

  const renderShuffledAudioWithPadding = async (originalAudioBuffer, segments, paddingDuration, mode) => {
    // Calculate total duration: all segments without padding
    const totalDuration = segments.length * segments[0].duration;

    const offlineCtx = new OfflineAudioContext(
      originalAudioBuffer.numberOfChannels,
      Math.ceil(totalDuration * originalAudioBuffer.sampleRate),
      originalAudioBuffer.sampleRate
    );

    let outputTime = 0;

    // For each segment, extract audio and place it in output (skipping padding)
    segments.forEach((segment) => {
      const source = offlineCtx.createBufferSource();
      source.buffer = originalAudioBuffer;
      // Start at outputTime, read from segment.start, for segment.duration
      source.start(outputTime, segment.start, segment.duration);
      source.connect(offlineCtx.destination);
      outputTime += segment.duration;
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer;
  };

  const applyAudioShuffling = async (sourceBuffer, segSize, pad, seed) => {
    if (!sourceBuffer) return null;

    const numSegments = Math.ceil(sourceBuffer.duration / segSize);
    // const remainder = sourceBuffer.duration - (numSegments * segSize);

    const newSegments = [];
    for (let i = 0; i < numSegments; i++) {
      newSegments.push({
        start: i * segSize,
        duration: segSize,
        originalIndex: i
      });
    }

    // if (remainder > 0) {
    //   newSegments.push({
    //     start: numSegments * segSize,
    //     duration: remainder,
    //     originalIndex: numSegments
    //   });
    // }

    const originalOrder = newSegments.map(s => s.originalIndex);
    const shuffleOrder = seededShuffle(originalOrder, seed);
    const shuffledSegs = shuffleOrder.map(idx => newSegments[idx]);

    const newRenderedBuffer = await renderShuffledAudioWithPadding(sourceBuffer, shuffledSegs, pad, "shuffleAudio");

    return { buffer: newRenderedBuffer, shuffleOrder: shuffleOrder };
  };

  const getShuffleOrder = (length, seed) => {
    const rng = seededRandom(seed);
    const order = Array.from({ length }, (_, i) => i);

    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
  };

  const unshuffleAudio = async (shuffledBuffer, segSize, pad, shuffleOrderOrSeed, originalDuration) => {
    let shuffleOrder;
    if (Array.isArray(shuffleOrderOrSeed)) {
      shuffleOrder = shuffleOrderOrSeed;
    } else {
      const numSegments = Math.ceil(originalDuration / segSize);
      shuffleOrder = getShuffleOrder(numSegments, shuffleOrderOrSeed);
    }

    console.log("Shuffled order:", shuffleOrder);

    const numSegments = shuffleOrder.length;

    // Create inverse mapping: if shuffleOrder[i] = j, then segment at position j in shuffled 
    // should go to position i in unshuffled
    const inverseOrder = new Array(numSegments);
    for (let i = 0; i < numSegments; i++) {
      inverseOrder[shuffleOrder[i]] = i;
    }

    console.log("Inverse order:", inverseOrder);

    const unshuffledSegments = [];

    // Build segments to extract from shuffled buffer in the order they should appear in final output
    for (let finalPos = 0; finalPos < numSegments; finalPos++) {
      // Find which position in shuffled buffer contains the segment for finalPos
      const shuffledPos = inverseOrder[finalPos];
      const startTime = shuffledPos * (segSize + pad);

      // All segments are equal length now (no remainder handling)
      const duration = segSize;

      unshuffledSegments.push({
        start: startTime,
        duration: duration,
        originalIndex: finalPos
      });
    }

    console.log("Unshuffling segments:", unshuffledSegments);

    const unshuffledBuffer = await renderShuffledAudioWithPadding(shuffledBuffer, unshuffledSegments, 0, "unshuffleAudio");
    return unshuffledBuffer;
  };

  const bufferToWavUrl = (buffer, numChannels, sr) => {
    const resultSize = buffer.length * numChannels * 2 + 44;
    const view = new DataView(new ArrayBuffer(resultSize));
    let offset = 0;

    const writeString = (view, offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    const floatTo16BitPCM = (output, offset, input) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    };

    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + resultSize - 44, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sr, true); offset += 4;
    view.setUint32(offset, sr * numChannels * 2, true); offset += 4;
    view.setUint16(offset, numChannels * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, resultSize - offset, true); offset += 4;

    if (numChannels === 1) {
      floatTo16BitPCM(view, offset, buffer.getChannelData(0));
    } else {
      const interleaved = new Float32Array(buffer.length * numChannels);
      for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          interleaved[i * numChannels + channel] = buffer.getChannelData(channel)[i];
        }
      }
      floatTo16BitPCM(view, offset, interleaved);
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  const decodeKeyCode = () => {
    try {
      const json = fromBase64(keyCode);
      const params = JSON.parse(json);
      setDecodedParams(params);
      success('Key code decoded successfully!');
      console.log("Decoded (XOR Decrypt) key parameters:", params);
    } catch (e) {
      try {
        const keyData = decryptKeyData(keyCode);
        setDecodedParams(keyData);
        console.log("Decoded (Base64) key data from code:", keyData);
      } catch (err) {
        console.error("Error decoding key code:", err);
      }
      error('Invalid key code: ' + e.message);
    }
  };

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

  // =============================
  // EVENT HANDLERS
  // =============================
  const handleScrambledFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      error("Please select a valid audio file");
      return;
    }

    setFilename(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);

      setAudioBuffer(buffer);
      setAudioDuration(buffer.duration);
      setSampleRate(buffer.sampleRate);
      setNumberOfChannels(buffer.numberOfChannels);
      setSelectedFile(file);
      setScrambledAudioBuffer(buffer);

      const objectUrl = URL.createObjectURL(file);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = objectUrl;
      }

      console.log(`Audio loaded: ${buffer.duration.toFixed(2)}s`);

      success(`Audio loaded: ${buffer.duration.toFixed(2)}s`);
    } catch (err) {
      console.error("Error processing audio file:", err);
      error('Error loading audio file');
    }
  };

  const applyParametersFromKey = (keyData) => {

    let x = {
      "timestamp": "2025-12-29T22:38:39.117Z",
      "audio": {
        "duration": 54.04470833333333,
        "sampleRate": 48000, "channels": 2
      },
      "shuffle": { "enabled": true, "seed": 12345, "segmentSize": 5, "padding": 0.5, "shuffleOrder": [5, 2, 10, 9, 8, 6, 7, 1, 3, 0, 4] },
      "noise": { "enabled": true, "seed": 54321, "level": 1, "multiFrequency": true },
      "user": { "username": "ikemnkur", "userId": "Unknown", "timestamp": "2025-12-29T22:38:39.117Z" },
      "type": "audio", "version": "basic"
    }

    setSegmentSize(keyData.shuffle?.segmentSize);
    setPadding(keyData.shuffle?.padding)
    setNoiseLevel(keyData.noise?.level)
    setShuffleSeed(keyData.shuffle?.seed)
    setNoiseSeed(keyData.noise?.seed)
    setCreatorInfo({
      username: keyData.user?.username || 'Unknown',
      userId: keyData.user?.userId || 'Unknown',
      time: keyData.user?.timestamp || new Date().toISOString()
    });
    setMetadata({
      filename: keyData.audio?.filename || 'untitled.wav',
      size: keyData.audio?.size || 0,
      fileType: keyData.audio?.fileType || '.wav',
      duration: keyData.audio?.duration || 0,
      sampleRate: keyData.audio?.sampleRate || 48000,
      channels: keyData.audio?.channels || 2
    });

  };

  const confirmSpendingCredits = () => {

    //     const LQ = 2;
    //     const SDcharge = 3;
    //     const HDcharge = 5;
    //     const FHDCharge = 10;

    //     let fileDetails = {
    //       type: 'audio',
    //       size: selectedFile?.size || 0,
    //       name: filename || '',
    //       duration: Math.ceil(audioPlayerRef.current?.duration) || 0,
    //       sampleRate: sampleRate,
    //       numberOfChannels: numberOfChannels,
    //     }

    //     const duration2 = Math.ceil((fileDetails.duration || 0) / 60); // duration in minutes
    //     const sampleRate2 = fileDetails.sampleRate || 44100;
    //     const numberOfChannels2 = fileDetails.numberOfChannels || 2;

    //     console.log('Audio Duration:', fileDetails.duration, 'seconds (', duration2, 'minutes)');
    //     console.log('Audio Size:', fileDetails.size, 'bytes');
    //     console.log("cost due to size: ", (1 + fileDetails.size / (1000 * 1000 * 1)))


    // let calculatedCost = Math.ceil((sampleRate2 / 24000) * duration2 + (numberOfChannels2 * fileDetails.size / (1000 * 1000 * 1))); // scale by size in MB over 1MB

    //     console.log('Calculated Audio Cost:', calculatedCost);


    //     const finalCost = Math.ceil(calculatedCost * Math.sqrt(scrambleLevel));
    //     console.log('Total Cost after scramble level adjustment:', finalCost);
    //     setActionCost(finalCost);

    //     // Show credit confirmation modal before scrambling
    //     if (!audioBuffer) {
    //       error("Please load an audio file first!");
    //       return;
    //     }

    //     setScrambleLevel(2 + audioDuration / segmentSize);
    setShowCreditModal(true);

    // onGenerate();
  };

  const handleCreditConfirm = useCallback(async (actualCostSpent) => {
    setShowCreditModal(false);
    setIsProcessing(true);


    setActionCost(localStorage.getItem('lastActionCost') || 0);

    try {
      // Apply segment shuffling
      handleUnscrambleAudio();

      // applySteganography();

      setIsProcessing(false);
      setUserCredits(prev => prev - actionCost);
      success(`Audio scrambled! ${actionCost} credits used.`);

    } catch (err) {

      console.error('Scramble error:', err);
      error('Error during scrambling: ' + err.message);
      setIsProcessing(false);

      handleRefundCredits();

    }
  }, [audioBuffer, segmentSize, padding, shuffleSeed, noiseLevel, noiseSeed, actionCost, setUserCredits, success, error]);



  const handleKeyFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const keyData = decryptKeyData(text);
      if (keyData.type !== "audio") {
        error('The loaded key file is not a valid video scramble key.');
        throw new Error('Invalid key file type');
      } else if (keyData.version !== "basic") {
        error('Use the ' + keyData.version + ' ' + keyData.type + ' scrambler to unscramble this file.');
        alert('The loaded key file will not work with this scrambler version, you must use the ' + keyData.version + ' ' + keyData.type + ' scrambler to unscramble this file.');
        throw new Error('Incompatible key file version');
      }
      setLoadedKeyData(keyData);
      applyParametersFromKey(keyData);
      success('🔑 Key loaded!');
    } catch (err) {
      console.error("Error loading key:", err);
      error('Invalid or corrupted key file');
    }
  };

  const handleUnscrambleAudio = async () => {
    if (!scrambledAudioBuffer) {
      error('Please load scrambled audio!');
      return;
    }

    if (!loadedKeyData) {
      error('Please load key file!');
      return;
    }

    setIsProcessing(true);

    try {
      let recoveredBuffer = scrambledAudioBuffer;

      // Remove noise
      if (loadedKeyData.noise?.enabled) {
        const noise = generateMultiFrequencyNoise(
          scrambledAudioBuffer.length,
          loadedKeyData.noise.level,
          loadedKeyData.noise.seed
        );
        recoveredBuffer = reverseNoise(recoveredBuffer, noise);
      }

      // Un-shuffle
      if (loadedKeyData.shuffle?.enabled) {
        const shuffleOrderOrSeed = loadedKeyData.shuffle.shuffleOrder || loadedKeyData.shuffle.seed;

        recoveredBuffer = await unshuffleAudio(
          recoveredBuffer,
          loadedKeyData.shuffle.segmentSize,
          loadedKeyData.shuffle.padding,
          shuffleOrderOrSeed,
          loadedKeyData.audio.duration
        );
      }

      setRecoveredAudioBuffer(recoveredBuffer);

      // Apply steganography watermark
      let steganoAudioBuffer = await applySteganography(recoveredBuffer);

      // If steganography failed, use the recovered buffer
      if (!steganoAudioBuffer) {
        steganoAudioBuffer = recoveredBuffer;
        console.warn('Steganography failed, using recovered buffer without watermark');
        let link2AudioFile = download_url

        console.log("Link to audio file with watermarking:", link2AudioFile);

        if (unscrambledAudioPlayerRef.current) {
          unscrambledAudioPlayerRef.current.src = link2AudioFile;
        }

        // convert link2AudioFile to audio buffer
        const audioResponse = await fetch(link2AudioFile);
        const audioArrayBuffer = await audioResponse.arrayBuffer();
        const watermarkedAudioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);

        setStegoAudioBuffer(watermarkedAudioBuffer);

        return;
      }

      setStegoAudioBuffer(steganoAudioBuffer);

      const url = bufferToWavUrl(steganoAudioBuffer, loadedKeyData.audio.channels, loadedKeyData.audio.sampleRate);

      if (unscrambledAudioPlayerRef.current) {
        unscrambledAudioPlayerRef.current.src = url;
      }

      setIsProcessing(false);
      success('✅ Audio unscrambled!');
    } catch (err) {
      console.error('Unscramble error:', err);
      error('Error: ' + err.message);
      setIsProcessing(false);
    }
  };

  const handleDownloadRecovered = () => {
    if (!stegoAudioBuffer) {
      error("Please unscramble audio first!");
      return;
    }

    const url = bufferToWavUrl(stegoAudioBuffer, loadedKeyData.audio.channels, loadedKeyData.audio.sampleRate);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovered-audio_' + filename.replace(/\.[^/.]+$/, "") + '.wav';
    a.click();
    success("Recovered audio downloaded!");
  };

  // Update waveforms on time update
  useEffect(() => {
    const audioPlayer = audioPlayerRef.current;
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

  useEffect(() => {
    const player = processedAudioPlayerRef.current;
    const canvas = processedCanvasRef.current;

    const updateWaveform = () => {
      if (finalAudioBuffer && canvas) {
        drawWaveform(finalAudioBuffer, canvas, player);
      }
    };

    if (player) {
      player.addEventListener('timeupdate', updateWaveform);
      player.addEventListener('loadedmetadata', updateWaveform);

      return () => {
        player.removeEventListener('timeupdate', updateWaveform);
        player.removeEventListener('loadedmetadata', updateWaveform);
      };
    }
  }, [finalAudioBuffer]);

  useEffect(() => {
    const player = unscrambledAudioPlayerRef.current;
    const canvas = unscrambledCanvasRef.current;

    const updateWaveform = () => {
      if (recoveredAudioBuffer && canvas) {
        drawWaveform(recoveredAudioBuffer, canvas, player);
      }
    };

    if (player) {
      player.addEventListener('timeupdate', updateWaveform);
      player.addEventListener('loadedmetadata', updateWaveform);

      return () => {
        player.removeEventListener('timeupdate', updateWaveform);
        player.removeEventListener('loadedmetadata', updateWaveform);
      };
    }
  }, [recoveredAudioBuffer]);

  // Todo:
  // upload file to back end to add stegano watermark with user info and timestamp, then download the watermarked file for unscrambling

  async function applySteganography(steganoAudioBuffer) {
    if (!steganoAudioBuffer) return null;

    const userInfo = {
      username: userData.username,
      time: new Date().toISOString(),
      userid: userData.id
    };

    const steganoData = JSON.stringify(userInfo);

    // convert audio buffer to wav blob to upload to backend
    const wavUrl = bufferToWavUrl(steganoAudioBuffer, loadedKeyData.audio.channels, loadedKeyData.audio.sampleRate);
    const blobResponse = await fetch(wavUrl);
    const blob = await blobResponse.blob();
    const file = new File([blob], 'recovered-audio.wav', { type: 'audio/wav' });

    try {
      console.log("Stegano Data, Hiding:", steganoData);

      // Create FormData with file and parameters
      const formData = new FormData();
      formData.append('file', file);
      formData.append('params', steganoData);

      // Add JWT token for authentication
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Call steganography endpoint
      const response = await fetch(`${API_URL}/api/audio-stegano-embed`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      const data = await response.json();

      console.log("Watermark steg. response:", data);

      if (!response.ok || !data.success) {
        error("Steganography failed: " + (data.message || "Unknown error"));
        setIsProcessing(false);
        return null;
      }

      success("Audio watermarked successfully!");

      let link2AudioFile = Flask_API_URL + data.download_url
      setDownloadUrl(link2AudioFile);

      console.log("Link to watermarked audio file:", link2AudioFile);
      // convert the returned URL to an audio buffer
      const audioResponse = await fetch(link2AudioFile);
      const audioArrayBuffer = await audioResponse.arrayBuffer();
      const watermarkedAudioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);

      setStegoAudioBuffer(watermarkedAudioBuffer);

      // Return the watermarked audio buffer or original if backend doesn't return one
      setTimeout(() => {
        return stegoAudioBuffer;
      }, 1000);

    } catch (err) {
      console.error('Steganography error:', err);
      error('Error applying steganography: ' + (err.message || 'Unknown error'));
      setIsProcessing(false);

      // Refund credits if applicable
      try {
        const refundResponse = await api.post(`${API_URL}/api/refund-credits`, {
          userId: userData.id,
          username: userData.username,
          email: userData.email,
          credits: actionCost,
          action: 'unscramble_audio_pro',
          reason: 'Steganography failed'
        });
        console.log("Refund response:", refundResponse.data);
      } catch (refundError) {
        console.error("Refund failed:", refundError);
      }

      return null;
    }
  }


  // =============================
  // RENDER
  // =============================
  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          {/* <AudioFile /> */}
          🎵 Audio Unscrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload scrambled audio and key, apply segment unshuffling and/or noise removal, and download the unscrambled audio.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Export: WAV" size="small" />
          <Chip label="Quality: 16-bit PCM" size="small" />
          <Chip label="Operations: Shuffle + Noise" size="small" />
        </Box>
      </Box>


      {/* Unscramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* <LockOpen /> */}
            🔓 Unscramble Audio
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                  Step 1
                </Typography>
                <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                  Select Scramble Audio
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                Scrambled Audio File
              </Typography>
              <input
                type="file"
                accept="audio/*"
                onChange={handleScrambledFileSelect}
                ref={audioFileInputRef}
                id="audio-file-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="audio-file-upload">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<AudioFile />}
                  sx={{ backgroundColor: '#2196f3', color: 'white' }}
                >
                  Choose Audio File
                </Button>
              </label>
              {selectedFile && (
                <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                  Selected: {selectedFile.name}
                </Typography>
              )}
            </Grid>
          </Grid>

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

          {/* Key Code Input
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
          </Box> */}

          {/* Unnscramble Action Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
              Step 3
            </Typography>
            <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
              Paste Your Unscramble Key
            </Typography>
          </Box>
          {/* <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}> */}



          <Button
            variant="contained"
            onClick={confirmSpendingCredits}

            startIcon={<LockOpen />}
            disabled={!scrambledAudioBuffer || !loadedKeyData || isProcessing}
            sx={{
              backgroundColor: (!scrambledAudioBuffer || !loadedKeyData || isProcessing) ? '#666' : '#4caf50',
              color: 'white',
              mb: 3
            }}
          >
            {isProcessing ? 'Unscrambling...' : 'Unscramble Audio'}
          </Button>

          {recoveredAudioBuffer && (
            <>
              <Divider sx={{ my: 3, backgroundColor: '#666' }} />
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>
                Recovered Audio
              </Typography>
              <canvas ref={unscrambledCanvasRef} width="600" height="150" style={{ width: '100%', height: 'auto', border: '1px solid #666', borderRadius: '4px', marginBottom: '10px' }} />
              <audio ref={unscrambledAudioPlayerRef} controls style={{ width: '100%', marginBottom: '15px' }} />

              <Button
                variant="contained"
                onClick={handleDownloadRecovered}
                startIcon={<Download />}
                sx={{ backgroundColor: '#28a745', color: 'white' }}
              >
                📥 Download Recovered Audio
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
        <Typography variant="body2" color="black">
          💡 Upload audio, scramble it with segment shuffling and multi-frequency noise, save the key,
          and export the result. The scrambled audio can only be recovered with the correct key file.
          Use this to protect your audio content from unauthorized distribution.
        </Typography>
      </Paper>


      {/* Credit Confirmation Modal */}
      {showCreditModal &&


        <CreditConfirmationModal
          open={showCreditModal}
          onClose={() => setShowCreditModal(false)}
          onConfirm={handleCreditConfirm}
          mediaType="audio"


          isProcessing={isProcessing}
          scrambleLevel={scrambleLevel}
          currentCredits={userCredits}
          fileName={filename}
          file={audioBuffer}
          fileDetails={{
            type: 'audio',
            duration: audioDuration,
            sampleRate: sampleRate,
            channels: numberOfChannels,
            name: filename,
            size: scrambledAudioBuffer ? (scrambledAudioBuffer.length * scrambledAudioBuffer.numberOfChannels * 4) / (1024 * 1024) : 0
          }}
          user={userData}
          actionType="unscramble-audio"
          actionDescription="Unscrambling audio"
        />
      }

      {/* Processing Modal */}
      <ProcessingModal open={isProcessing} mediaType="audio" />
    </Container>
  );
}
