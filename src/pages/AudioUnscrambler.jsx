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
  Shuffle,
  Download,
  Key,
  Lock,
  LockOpen,
  VolumeUp
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';

export default function AudioUnscrambler() {
  const { success, error } = useToast();

  // =============================
  // STATE & REFS
  // =============================
  const audioFileInput = useRef(null);
  const audioPlayerRef = useRef(null);
  const canvasRef = useRef(null);

  const processedAudioPlayerRef = useRef(null);
  const processedCanvasRef = useRef(null);

  const unscrambledAudioPlayerRef = useRef(null);
  const unscrambledCanvasRef = useRef(null);

  const [audioContext] = useState(() => new (window.AudioContext || window.webkitAudioContext)());
  const VIEW_SPAN = 10; // 10 seconds viewable area

  const [audioBuffer, setAudioBuffer] = useState(null);
  const [finalAudioBuffer, setFinalAudioBuffer] = useState(null);
  const [recoveredAudioBuffer, setRecoveredAudioBuffer] = useState(null);
  const [scrambledAudioBuffer, setScrambledAudioBuffer] = useState(null);

  const [generatedNoise, setGeneratedNoise] = useState(null);
  const [scramblingParameters, setScramblingParameters] = useState(null);
  const [loadedKeyData, setLoadedKeyData] = useState(null);

  const [shuffleSeed, setShuffleSeed] = useState('12345');
  const [noiseSeed, setNoiseSeed] = useState('54321');
  const [segmentSize, setSegmentSize] = useState('2');
  const [padding, setPadding] = useState('0.5');
  const [noiseLevel, setNoiseLevel] = useState('0.3');

  const [filename, setFilename] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [sampleRate, setSampleRate] = useState(48000);
  const [numberOfChannels, setNumberOfChannels] = useState(2);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  // const actionCost = 3;
  const [actionCost, setActionCost] = useState(3);

  const [userData] = useState(JSON.parse(localStorage.getItem("userdata")));

  // =============================
  // FETCH USER CREDITS
  // =============================
  useEffect(() => {
    const fetchCredits = async () => {
      if (!userData?.username) return;

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
        console.error('Error fetching credits:', err);
      }
    };

    fetchCredits();
  }, [userData]);

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

  const encryptKeyData = (keyObject) => {
    const jsonStr = JSON.stringify(keyObject);
    const encryptionKey = "AudioProtectionKey2025";
    const encrypted = xorEncrypt(jsonStr, encryptionKey);
    return btoa(encrypted);
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

  const applyNoise = (originalBuffer, noiseData) => {
    const originalData = originalBuffer.getChannelData(0);
    const combinedData = new Float32Array(originalData.length);

    for (let i = 0; i < originalData.length; i++) {
      const noiseIndex = i % noiseData.length;
      combinedData[i] = Math.max(-1, Math.min(1, originalData[i] + noiseData[noiseIndex]));
    }

    return createAudioBufferFromData(combinedData, originalBuffer.sampleRate, originalBuffer.numberOfChannels);
  };

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
    const totalDuration = segments.reduce((total, segment) =>
      total + segment.duration + paddingDuration, 0);

    let offlineCtx;
    if (mode === "shuffleAudio") {
      offlineCtx = new OfflineAudioContext(
        originalAudioBuffer.numberOfChannels,
        Math.ceil(totalDuration * originalAudioBuffer.sampleRate),
        originalAudioBuffer.sampleRate
      );
    } else if (mode === "unshuffleAudio") {
      offlineCtx = new OfflineAudioContext(
        numberOfChannels,
        Math.ceil(audioDuration * sampleRate),
        sampleRate
      );
    }

    let currentTime = 0.0;

    segments.forEach((segment, idx) => {
      const source = offlineCtx.createBufferSource();
      source.buffer = originalAudioBuffer;
      source.start(currentTime, segment.start, segment.duration);
      source.connect(offlineCtx.destination);
      currentTime += segment.duration + paddingDuration;
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer;
  };

  const applyAudioShuffling = async (sourceBuffer, segSize, pad, seed) => {
    if (!sourceBuffer) return null;

    const numSegments = Math.floor(sourceBuffer.duration / segSize);
    const remainder = sourceBuffer.duration - (numSegments * segSize);

    const newSegments = [];
    for (let i = 0; i < numSegments; i++) {
      newSegments.push({
        start: i * segSize,
        duration: segSize,
        originalIndex: i
      });
    }

    if (remainder > 0) {
      newSegments.push({
        start: numSegments * segSize,
        duration: remainder,
        originalIndex: numSegments
      });
    }

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

    const numSegments = shuffleOrder.length;
    const unshuffledSegments = [];

    for (let originalPos = 0; originalPos < numSegments; originalPos++) {
      const shuffledPos = shuffleOrder[originalPos];
      const startTime = shuffledPos * (segSize + pad);

      let duration = segSize;
      if (originalPos === numSegments - 1) {
        duration = originalDuration - (originalPos * segSize);
      }

      unshuffledSegments.push({
        start: startTime,
        duration: duration,
        originalIndex: originalPos
      });
    }

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
  const handleFileSelect = async (event) => {
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

      const objectUrl = URL.createObjectURL(file);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = objectUrl;
      }

      success(`Audio loaded: ${buffer.duration.toFixed(2)}s`);
    } catch (err) {
      console.error("Error processing audio file:", err);
      error('Error loading audio file');
    }
  };

  // const handleScrambleAudio = () => {
  //   if (!audioBuffer) {
  //     error("Please load an audio file first!");
  //     return;
  //   }
  //   setShowCreditModal(true);
  // };

  const handleCreditConfirm = useCallback(async (actualCostSpent) => {
    setShowCreditModal(false);
    setIsProcessing(true);


    // Now you have access to the actual cost that was calculated and spent
    console.log('Credits spent:', actualCostSpent);

    // You can use this value for logging, analytics, or displaying to user
    // For example, update a state variable:
    setActionCost(actualCostSpent);

    try {
      // const segSize = parseFloat(segmentSize) || 2;
      // const pad = parseFloat(padding) || 0.5;
      // const shuffleSd = parseInt(shuffleSeed) || 12345;
      // const noiseLevel_ = parseFloat(noiseLevel) || 0.3;
      // const noiseSd = parseInt(noiseSeed) || 54321;

      // // Apply shuffle
      // const shuffleResult = await applyAudioShuffling(audioBuffer, segSize, pad, shuffled);
      // const shuffled = shuffleResult.buffer;
      // const shuffleOrder = shuffleResult.shuffleOrder;

      // // Apply noise
      // const noise = generateMultiFrequencyNoise(shuffled.length, noiseLevel_, noiseSd);
      // const final = applyNoise(shuffled, noise);

      // setFinalAudioBuffer(final);
      // setGeneratedNoise(noise);

      // // Store parameters
      // const params = {
      //   version: "1.0",
      //   timestamp: new Date().toISOString(),
      //   audio: {
      //     duration: audioBuffer.duration,
      //     sampleRate: audioBuffer.sampleRate,
      //     channels: audioBuffer.numberOfChannels
      //   },
      //   shuffle: {
      //     enabled: true,
      //     seed: shuffleSd,
      //     segmentSize: segSize,
      //     padding: pad,
      //     shuffleOrder: shuffleOrder
      //   },
      //   noise: {
      //     enabled: true,
      //     seed: noiseSd,
      //     level: noiseLevel_,
      //     multiFrequency: true
      //   }
      // };

      // setScramblingParameters(params);

      // // Create playable URL
      // const url = bufferToWavUrl(final, final.numberOfChannels, final.sampleRate);
      // if (processedAudioPlayerRef.current) {
      //   processedAudioPlayerRef.current.src = url;
      // }

      handleUnscrambleAudio();

      setIsProcessing(false);
      setUserCredits(prev => prev - actionCost);
      success(`Audio scrambled! ${actionCost} credits used.`);

    } catch (err) {

      console.error('Scramble error:', err);
      error('Error during scrambling: ' + err.message);
      setIsProcessing(false);


      // try {
      // TODO: Refund credits if applicable
      const response = await fetch(`${API_URL}/api/refund-credits`, {
        method: 'POST',
        // headers: {
        //   'Content-Type': 'application/json'
        // },

        body: {
          userId: userData.id,
          username: userData.username,
          email: userData.email,
          password: localStorage.getItem('passwordtxt'),
          credits: actionCost,
          params: params,
        }
      });

      console.log("Refund response:", response);
    }
  }, [audioBuffer, segmentSize, padding, shuffleSeed, noiseLevel, noiseSeed, actionCost, setUserCredits, success, error]);



  const handleScrambledFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      setScrambledAudioBuffer(buffer);
      success('Scrambled audio loaded');
    } catch (err) {
      console.error("Error loading scrambled audio:", err);
      error('Error loading scrambled audio');
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

      const url = bufferToWavUrl(recoveredBuffer, loadedKeyData.audio.channels, loadedKeyData.audio.sampleRate);
      if (unscrambledAudioPlayerRef.current) {
        unscrambledAudioPlayerRef.current.src = url;
      }

      setIsProcessing(false);
      success('✅ Audio unscrambled!');
    } catch (err) {
      console.error('Unscramble error:', err);
      error('Error: ' + err.message);
      setIsProcessing(false);


      // try {
      // TODO: Refund credits if applicable
      const response = await fetch(`${API_URL}/api/refund-credits`, {
        method: 'POST',
        // headers: {
        //   'Content-Type': 'application/json'
        // },

        body: {
          userId: userData.id,
          username: userData.username,
          email: userData.email,
          password: localStorage.getItem('passwordtxt'),
          credits: actionCost,
          params: params,
        }
      });

      console.log("Refund response:", response);
    }
  };

  const handleDownloadRecovered = () => {
    if (!recoveredAudioBuffer) {
      error("Please unscramble audio first!");
      return;
    }

    const url = bufferToWavUrl(recoveredAudioBuffer, loadedKeyData.audio.channels, loadedKeyData.audio.sampleRate);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovered-audio.wav';
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

  // =============================
  // RENDER
  // =============================
  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <AudioFile />
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
            <LockOpen />
            🔓 Unscramble Audio
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                Scrambled Audio File
              </Typography>
              <input
                type="file"
                accept="audio/*"
                onChange={handleScrambledFileSelect}
                style={{ color: 'white' }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                Scramble Key File
              </Typography>
              <input
                type="file"
                accept=".key,.json,.txt"
                onChange={handleKeyFileSelect}
                style={{ color: 'white' }}
              />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            onClick={() => setShowCreditModal(true)}
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
      <CreditConfirmationModal
        open={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onConfirm={handleCreditConfirm}
        mediaType="audio"
        description="scramble audio"
        creditCost={actionCost}
        currentCredits={userCredits}
        fileName={filename}
        isProcessing={isProcessing}
        file={audioBuffer}
        fileDetails={{
          type: 'audio',
          duration: audioDuration,
          sampleRate: sampleRate,
          channels: numberOfChannels,
          name: filename,
          size: audioBuffer ? (audioBuffer.length * numberOfChannels * 4) / (1024 * 1024) : 0
        }}
        user={userData}
        actionType="scramble-audio"
      />
    </Container>
  );
}
