// AudioScrambler.jsx — Audio Scrambler (React)
// Audio scrambling with shuffle and noise operations
// Upload audio, apply segment shuffling and/or reversible noise
// Download scrambled audio and unscramble key

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

export default function AudioScrambler() {
  const { success, error } = useToast();

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

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
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [sampleRate, setSampleRate] = useState(48000);
  const [numberOfChannels, setNumberOfChannels] = useState(2);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [actionCost, setActionCost] = useState(3);
  const [scrambleLevel, setScrambleLevel] = useState(1);

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
    console
    return btoa(encrypted);
  };

  // const decryptKeyData = (encodedData) => {
  //   try {
  //     const encrypted = atob(encodedData);
  //     const encryptionKey = "AudioProtectionKey2025";
  //     const jsonStr = xorEncrypt(encrypted, encryptionKey);
  //     return JSON.parse(jsonStr);
  //   } catch (err) {
  //     console.error('Decryption error:', err);
  //     throw new Error('Invalid or corrupted key file');
  //   }
  // };

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

      setSelectedFile(file);

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

  const handleScrambleAudio = () => {
    if (!audioBuffer) {
      error("Please load an audio file first!");
      return;
    }

    setScrambleLevel(2 + audioDuration / segmentSize);
    setShowCreditModal(true);
  };

  const handleCreditConfirm = async (actualCostSpent) => {
    setShowCreditModal(false);
    setIsProcessing(true);

    // Now you have access to the actual cost that was calculated and spent
    console.log('Credits spent:', actualCostSpent);

    // You can use this value for logging, analytics, or displaying to user
    // For example, update a state variable:
    // setLastCreditCost(actualCostSpent);
    setActionCost(actualCostSpent);

    try {
      const segSize = parseFloat(segmentSize) || 2;
      const pad = parseFloat(padding) || 0.5;
      const shuffleSd = parseInt(shuffleSeed) || 12345;
      const noiseLevel_ = parseFloat(noiseLevel) || 0.3;
      const noiseSd = parseInt(noiseSeed) || 54321;

      // Apply shuffle
      const shuffleResult = await applyAudioShuffling(audioBuffer, segSize, pad, shuffleSd);
      const shuffled = shuffleResult.buffer;
      const shuffleOrder = shuffleResult.shuffleOrder;

      // Apply noise
      const noise = generateMultiFrequencyNoise(shuffled.length, noiseLevel_, noiseSd);
      const final = applyNoise(shuffled, noise);

      setFinalAudioBuffer(final);
      setGeneratedNoise(noise);

      // Store parameters
      const params = {
        // version: "1.0",
        timestamp: new Date().toISOString(),
        audio: {
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels
        },
        shuffle: {
          enabled: true,
          seed: shuffleSd,
          segmentSize: segSize,
          padding: pad,
          shuffleOrder: shuffleOrder
        },
        noise: {
          enabled: true,
          seed: noiseSd,
          level: noiseLevel_,
          multiFrequency: true
        },
        user: {
          username: userData.username || 'Anonymous',
          userId: userData.userId || 'Unknown',
          timestamp: new Date().toISOString()
        },
        type: "audio",
        version: "basic"

      };

      setScramblingParameters(params);

      // Create playable URL
      const url = bufferToWavUrl(final, final.numberOfChannels, final.sampleRate);
      if (processedAudioPlayerRef.current) {
        processedAudioPlayerRef.current.src = url;
      }

      setIsProcessing(false);
      setUserCredits(prev => prev - actionCost);
      success(`Audio scrambled! ${actionCost} credits used.`);
    } catch (err) {
      console.error('Scramble error:', err);
      error('Error during scrambling: ' + err.message);

      setIsProcessing(false);


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
          params: { audioDuration, sampleRate, numberOfChannels },
        }

      });

      console.log("Refund response:", response);

      throw new Error(data.error || data.message || 'Scrambling failed');



    }
  };

  const handleDownloadScrambled = () => {
    if (!finalAudioBuffer) {
      error("Please scramble audio first!");
      return;
    }

    const url = bufferToWavUrl(finalAudioBuffer, finalAudioBuffer.numberOfChannels, finalAudioBuffer.sampleRate);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ? filename.replace(/\.[^/.]+$/, "").replace(/[^\w\-. ]+/g, '').replace(/\s+/g, '_') + '-scrambled.wav' : 'scrambled-audio.wav';
    a.click();
    success("Scrambled audio downloaded!");
  };

  const handleDownloadKey = () => {
    if (!scramblingParameters) {
      error('No scrambling parameters!');
      return;
    }

    try {
      const encryptedKey = encryptKeyData(scramblingParameters);
      const blob = new Blob([encryptedKey], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename ? filename.replace(/\.[^/.]+$/, "") + '-unscramble.key' : 'audio-unscramble.key';
      a.click();
      URL.revokeObjectURL(url);

      success('🔑 Protection key downloaded!');
    } catch (err) {
      console.error('Key download error:', err);
      error('Error downloading key');
    }
  };

  // const handleScrambledFileSelect = async (event) => {
  //   const file = event.target.files?.[0];
  //   if (!file) return;

  //   try {
  //     const arrayBuffer = await file.arrayBuffer();
  //     const buffer = await audioContext.decodeAudioData(arrayBuffer);
  //     setScrambledAudioBuffer(buffer);
  //     success('Scrambled audio loaded');
  //   } catch (err) {
  //     console.error("Error loading scrambled audio:", err);
  //     error('Error loading scrambled audio');
  //   }
  // };

  // const handleKeyFileSelect = async (event) => {
  //   const file = event.target.files?.[0];
  //   if (!file) return;

  //   try {
  //     const text = await file.text();
  //     const keyData = decryptKeyData(text);
  //     setLoadedKeyData(keyData);
  //     success('🔑 Key loaded!');
  //   } catch (err) {
  //     console.error("Error loading key:", err);
  //     error('Invalid or corrupted key file');
  //   }
  // };

  // const handleUnscramble = async () => {
  //   if (!scrambledAudioBuffer) {
  //     error('Please load scrambled audio!');
  //     return;
  //   }

  //   if (!loadedKeyData) {
  //     error('Please load key file!');
  //     return;
  //   }

  //   setIsProcessing(true);

  //   try {
  //     let recoveredBuffer = scrambledAudioBuffer;

  //     // Remove noise
  //     if (loadedKeyData.noise?.enabled) {
  //       const noise = generateMultiFrequencyNoise(
  //         scrambledAudioBuffer.length,
  //         loadedKeyData.noise.level,
  //         loadedKeyData.noise.seed
  //       );
  //       recoveredBuffer = reverseNoise(recoveredBuffer, noise);
  //     }

  //     // Un-shuffle
  //     if (loadedKeyData.shuffle?.enabled) {
  //       const shuffleOrderOrSeed = loadedKeyData.shuffle.shuffleOrder || loadedKeyData.shuffle.seed;

  //       recoveredBuffer = await unshuffleAudio(
  //         recoveredBuffer,
  //         loadedKeyData.shuffle.segmentSize,
  //         loadedKeyData.shuffle.padding,
  //         shuffleOrderOrSeed,
  //         loadedKeyData.audio.duration
  //       );
  //     }

  //     setRecoveredAudioBuffer(recoveredBuffer);

  //     const url = bufferToWavUrl(recoveredBuffer, loadedKeyData.audio.channels, loadedKeyData.audio.sampleRate);
  //     if (unscrambledAudioPlayerRef.current) {
  //       unscrambledAudioPlayerRef.current.src = url;
  //     }

  //     setIsProcessing(false);
  //     success('✅ Audio unscrambled!');
  //   } catch (err) {
  //     console.error('Unscramble error:', err);
  //     error('Error: ' + err.message);
  //     setIsProcessing(false);
  //   }
  // };

  // const handleDownloadRecovered = () => {
  //   if (!recoveredAudioBuffer) {
  //     error("Please unscramble audio first!");
  //     return;
  //   }

  //   const url = bufferToWavUrl(recoveredAudioBuffer, loadedKeyData.audio.channels, loadedKeyData.audio.sampleRate);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = 'recovered-audio.wav';
  //   a.click();
  //   success("Recovered audio downloaded!");
  // };



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

    // Load audio into player when finalAudioBuffer changes
    if (finalAudioBuffer && player) {
      const url = bufferToWavUrl(finalAudioBuffer, finalAudioBuffer.numberOfChannels, finalAudioBuffer.sampleRate);
      player.src = url;
      player.load(); // Explicitly load the audio
    }

    const updateWaveform = () => {
      if (finalAudioBuffer && canvas) {
        drawWaveform(finalAudioBuffer, canvas, player);
      }
    };

    // Draw immediately when finalAudioBuffer changes
    if (finalAudioBuffer && canvas) {
      drawWaveform(finalAudioBuffer, canvas, player);
    }

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
          {/* <AudioFile /> */}
          🎵 Audio Scrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload audio, splice & shuffle it, add reversible noise, and download the secret audio and unscramble key
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Export: WAV" size="small" />
          <Chip label="Quality: 16-bit PCM" size="small" />
          <Chip label="Operations: Shuffle + Noise" size="small" />
        </Box>
      </Box>

      {/* Original Audio Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <VolumeUp />
            Original Audio
          </Typography>

          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="audio-upload"
            ref={audioFileInput}
          />
          <label htmlFor="audio-upload">
            <Button
              variant="contained"
              component="span"
              startIcon={<AudioFile />}
              sx={{ backgroundColor: '#2196f3', color: 'white', mb: 2 }}
            >
              Choose Audio File
            </Button>
          </label>

          {filename && (
            <Typography variant="body2" sx={{ color: '#4caf50', mb: 2 }}>
              Selected: {filename}
            </Typography>
          )}

          <canvas ref={canvasRef} width="600" height="150" style={{ width: '100%', height: 'auto', border: '1px solid #666', borderRadius: '4px', marginBottom: '10px' }} />
          <audio ref={audioPlayerRef} controls style={{ width: '100%' }} />
        </CardContent>
      </Card>

      {/* Scramble Operations Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Lock />
            Scramble Audio
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>
                🔀 Shuffle Settings
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Shuffle Seed
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    value={shuffleSeed}
                    onChange={(e) => setShuffleSeed(e.target.value)}
                    placeholder="e.g., 12345"
                    size="small"
                    sx={{ flex: 1, backgroundColor: '#353535', input: { color: 'white' } }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setShuffleSeed(generateRandomSeed().toString())}
                    sx={{ borderColor: '#666', color: '#e0e0e0' }}
                  >
                    🎲 Random
                  </Button>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Segment Size (seconds)
                </Typography>
                <TextField
                  value={segmentSize}
                  onChange={(e) => setSegmentSize(e.target.value)}
                  type="number"
                  size="small"
                  fullWidth
                  sx={{ backgroundColor: '#353535', input: { color: 'white' } }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Padding (seconds)
                </Typography>
                <TextField
                  value={padding}
                  onChange={(e) => setPadding(e.target.value)}
                  type="number"
                  size="small"
                  fullWidth
                  sx={{ backgroundColor: '#353535', input: { color: 'white' } }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>
                🔊 Noise Settings
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Noise Seed
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    value={noiseSeed}
                    onChange={(e) => setNoiseSeed(e.target.value)}
                    placeholder="e.g., 54321"
                    size="small"
                    sx={{ flex: 1, backgroundColor: '#353535', input: { color: 'white' } }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setNoiseSeed(generateRandomSeed().toString())}
                    sx={{ borderColor: '#666', color: '#e0e0e0' }}
                  >
                    🎲 Random
                  </Button>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                  Noise Strength (0.0 - 1.0)
                </Typography>
                <TextField
                  value={noiseLevel}
                  onChange={(e) => setNoiseLevel(e.target.value)}
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, max: 1, step: 0.01 }}
                  sx={{ backgroundColor: '#353535', input: { color: 'white' } }}
                />
              </Box>
            </Grid>
          </Grid>

          {/* Scramble Action Buttons */}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button
              variant="contained"
              onClick={handleScrambleAudio}
              startIcon={<Lock />}
              disabled={!audioBuffer || isProcessing}
              sx={{
                backgroundColor: (!audioBuffer || isProcessing) ? '#666' : '#22d3ee',
                color: (!audioBuffer || isProcessing) ? '#999' : '#001018',
                fontWeight: 'bold'
              }}
            >
              {isProcessing ? 'Processing...' : '🔒 Scramble Audio (Shuffle + Noise)'}
            </Button>
          </Box>

          {finalAudioBuffer && (
            <>
              <Divider sx={{ my: 3, backgroundColor: '#666' }} />
              <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>
                Scrambled Audio Preview
              </Typography>
              <canvas ref={processedCanvasRef} width="600" height="150" style={{ width: '100%', height: 'auto', border: '1px solid #666', borderRadius: '4px', marginBottom: '10px' }} />
              <audio ref={processedAudioPlayerRef} controls style={{ width: '100%', marginBottom: '15px' }} />

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleDownloadScrambled}
                  startIcon={<Download />}
                  sx={{ backgroundColor: '#9c27b0', color: 'white' }}
                >
                  📥 Download Scrambled Audio
                </Button>

                <Button
                  variant="contained"
                  onClick={handleDownloadKey}
                  startIcon={<Key />}
                  sx={{ backgroundColor: '#dc3545', color: 'white' }}
                >
                  🔑 Download Scramble Key
                </Button>
              </Box>

              <Alert severity="warning" sx={{ backgroundColor: '#ff9800', color: 'white' }}>
                ⚠️ Keep the key file safe - you'll need it to unscramble the audio!
              </Alert>
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
        isProcessing={isProcessing}
        scrambleLevel={scrambleLevel}
        currentCredits={userCredits}

        fileName={filename}
        file={audioBuffer}
        fileDetails={{
          type: 'audio',
          size: selectedFile?.size || 0,
          name: filename || '',
          duration: Math.ceil(audioPlayerRef.current?.duration) || 0,
          sampleRate: sampleRate,
          numberOfChannels: numberOfChannels,
        }}

        user={userData}
        actionType="scramble-audio"
        actionDescription="Scrambling audio"
      />
    </Container>
  );
}
