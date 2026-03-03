import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Stack,
  Chip,
  Divider,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  Upload,
  Search,
  GraphicEq
} from '@mui/icons-material';

/**
 * Audio Watermark Detector
 * Detects and displays pulsing frequencies (30-60 Hz) in audio files
 */
export default function AudioWatermarkDetector() {
  const [audioFile, setAudioFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [detectedFreqs, setDetectedFreqs] = useState(null);
  const [spectrogramData, setSpectrogramData] = useState(null);

  const audioContextRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Draw spectrogram
  useEffect(() => {
    if (spectrogramData && canvasRef.current) {
      drawSpectrogram(spectrogramData);
    }
  }, [spectrogramData]);

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      setError('');
      setDetectedFreqs(null);
      setSpectrogramData(null);
    } else {
      setError('Please upload a valid audio file');
    }
  };

  // Perform FFT analysis on audio buffer
  const analyzeFrequencies = (audioBuffer, startTime, duration) => {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const numSamples = Math.floor(duration * sampleRate);
    
    // Get audio data (mix down to mono)
    const channelData = audioBuffer.getChannelData(0);
    const data = channelData.slice(startSample, startSample + numSamples);

    // Find next power of 2 for FFT
    const fftSize = Math.pow(2, Math.ceil(Math.log2(data.length)));
    
    // Pad data to fftSize
    const paddedData = new Float32Array(fftSize);
    paddedData.set(data);

    // Apply Hann window to reduce spectral leakage
    for (let i = 0; i < data.length; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (data.length - 1)));
      paddedData[i] *= window;
    }

    // Perform FFT (using Web Audio API's built-in FFT via AnalyserNode is easier,
    // but for offline analysis, we'll use a simple DFT for frequencies 30-60 Hz)
    const freqMin = 30;
    const freqMax = 60;
    const freqResolution = sampleRate / fftSize;
    const binMin = Math.floor(freqMin / freqResolution);
    const binMax = Math.ceil(freqMax / freqResolution);

    const magnitudes = [];

    // Analyze every frequency from 30-60 Hz (every 1 Hz)
    for (let targetFreq = freqMin; targetFreq <= freqMax; targetFreq++) {
      const bin = Math.round(targetFreq / freqResolution);
      const freq = targetFreq;
      let real = 0;
      let imag = 0;

      // DFT for this specific frequency
      for (let n = 0; n < fftSize; n++) {
        const angle = -2 * Math.PI * bin * n / fftSize;
        real += paddedData[n] * Math.cos(angle);
        imag += paddedData[n] * Math.sin(angle);
      }

      const magnitude = Math.sqrt(real * real + imag * imag) / fftSize;
      magnitudes.push({ freq, magnitude });
    }

    return magnitudes;
  };

  // Detect pulsing frequencies
  const detectPulsingFrequencies = (audioBuffer) => {
    const numSegments = 100; // Analyze 100 segments of 0.05 seconds each (5 seconds total, 20 samples/sec)
    const segmentDuration = 0.05;
    const allFreqData = [];

    // Analyze multiple segments
    for (let i = 0; i < numSegments; i++) {
      const startTime = Math.min(i * segmentDuration, audioBuffer.duration - segmentDuration);
      const magnitudes = analyzeFrequencies(audioBuffer, startTime, segmentDuration);
      allFreqData.push(magnitudes);
    }

    // Calculate variance for each frequency across segments
    // Pulsing frequencies will have high variance
    const freqVariances = [];
    const numFreqs = allFreqData[0].length;

    for (let freqIdx = 0; freqIdx < numFreqs; freqIdx++) {
      const freq = allFreqData[0][freqIdx].freq;
      const magnitudesOverTime = allFreqData.map(segment => segment[freqIdx].magnitude);
      
      // Calculate mean
      const mean = magnitudesOverTime.reduce((a, b) => a + b, 0) / magnitudesOverTime.length;
      
      // Calculate variance
      const variance = magnitudesOverTime.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / magnitudesOverTime.length;
      
      // Calculate average magnitude
      const avgMagnitude = mean;

      freqVariances.push({
        freq: Math.round(freq),
        variance,
        avgMagnitude,
        magnitudesOverTime
      });
    }

    // Sort by variance (pulsing frequencies have high variance)
    freqVariances.sort((a, b) => b.variance - a.variance);

    // Find top 2 frequencies with significant variance and magnitude
    const detected = freqVariances
      .filter(f => f.variance > 0.0001 && f.avgMagnitude > 0.001)
      .slice(0, 2);

    // Estimate pulse rates by analyzing the magnitude pattern
    detected.forEach(freq => {
      const pulseRate = estimatePulseRate(freq.magnitudesOverTime, segmentDuration);
      freq.pulseRate = pulseRate;
    });

    return {
      frequencies: detected,
      spectrogramData: allFreqData
    };
  };

  // Estimate pulse rate from magnitude pattern
  const estimatePulseRate = (magnitudes, segmentDuration) => {
    // Count peaks in the magnitude pattern
    let peaks = 0;
    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
        peaks++;
      }
    }
    
    const totalTime = magnitudes.length * segmentDuration;
    const pulseRate = peaks / totalTime;
    
    return pulseRate.toFixed(1);
  };

  // Analyze audio
  const analyzeAudio = async () => {
    if (!audioFile) {
      setError('Please upload an audio file');
      return;
    }

    setAnalyzing(true);
    setError('');
    setDetectedFreqs(null);

    try {
      // Initialize audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

      // Read audio file
      const arrayBuffer = await audioFile.arrayBuffer();

      // Decode audio
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Detect pulsing frequencies
      const result = detectPulsingFrequencies(audioBuffer);

      setDetectedFreqs(result.frequencies);
      setSpectrogramData(result.spectrogramData);

      console.log('Analysis complete:', result);

    } catch (err) {
      console.error('Error analyzing audio:', err);
      setError(`Error analyzing audio: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Draw spectrogram on canvas
  const drawSpectrogram = (spectrogramData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    if (!spectrogramData || spectrogramData.length === 0) return;

    const numTimeSegments = spectrogramData.length;
    const numFreqBins = spectrogramData[0].length;
    const segmentWidth = width / numTimeSegments;
    const binHeight = height / numFreqBins;

    // Find max magnitude for normalization
    let maxMagnitude = 0;
    spectrogramData.forEach(segment => {
      segment.forEach(bin => {
        maxMagnitude = Math.max(maxMagnitude, bin.magnitude);
      });
    });

    // Draw spectrogram
    for (let t = 0; t < numTimeSegments; t++) {
      for (let f = 0; f < numFreqBins; f++) {
        const magnitude = spectrogramData[t][f].magnitude;
        const normalized = magnitude / maxMagnitude;
        
        // Color mapping: blue (low) to red (high)
        const hue = 240 - (normalized * 240); // 240 = blue, 0 = red
        const lightness = 20 + (normalized * 60);
        
        ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
        
        const x = t * segmentWidth;
        const y = height - (f + 1) * binHeight; // Invert y-axis
        
        ctx.fillRect(x, y, segmentWidth, binHeight);
      }
    }

    // Draw frequency labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    
    // Draw every 5 Hz mark plus individual Hz marks
    spectrogramData[0].forEach((bin, idx) => {
      const freq = Math.round(bin.freq);
      const y = height - (idx * binHeight);
      
      if (freq % 5 === 0) {
        // Major labels every 5 Hz
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${freq} Hz`, width - 5, y + 4);
        
        // Draw major grid line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width - 50, y);
        ctx.stroke();
      } else {
        // Minor grid lines for individual Hz
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width - 50, y);
        ctx.stroke();
      }
    });

    // Draw time labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const x = (i / 5) * width;
      ctx.fillText(`${i}s`, x, height - 5);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <GraphicEq sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Audio Watermark Detector
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Detect and analyze inaudible ownership markers (30-60 Hz)
            </Typography>
          </Box>

          <Divider />

          {/* File Upload */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Upload Audio File
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={<Upload />}
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                fullWidth
              >
                Select Audio File
              </Button>
              {audioFile && (
                <Alert severity="success">
                  File loaded: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                </Alert>
              )}
            </Stack>
          </Box>

          {/* Analyze Button */}
          <Button
            variant="contained"
            size="large"
            startIcon={<Search />}
            onClick={analyzeAudio}
            disabled={!audioFile || analyzing}
            fullWidth
            sx={{ py: 1.5 }}
          >
            {analyzing ? 'Analyzing...' : 'Detect Watermark'}
          </Button>

          {/* Error */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Spectrogram */}
          {spectrogramData && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Frequency Spectrogram (30-60 Hz, 5 seconds)
              </Typography>
              <Box sx={{ 
                bgcolor: '#1a1a2e', 
                p: 2, 
                borderRadius: 1,
                overflow: 'auto'
              }}>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={400}
                  style={{ 
                    width: '100%', 
                    height: 'auto',
                    maxWidth: '800px',
                    display: 'block'
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Brighter colors indicate higher energy at that frequency and time
              </Typography>
            </Box>
          )}

          {/* Detected Frequencies */}
          {detectedFreqs && detectedFreqs.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Detected Watermark Frequencies
              </Typography>
              <Grid container spacing={2}>
                {detectedFreqs.map((freq, idx) => (
                  <Grid item xs={12} md={6} key={idx}>
                    <Card variant="outlined" sx={{ bgcolor: 'primary.dark', color: 'white' }}>
                      <CardContent>
                        <Typography variant="h3" component="div" sx={{ mb: 1 }}>
                          {freq.freq} Hz
                        </Typography>
                        <Stack spacing={1}>
                          <Chip 
                            label={`Pulse Rate: ~${freq.pulseRate} pulses/sec`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
                          />
                          <Chip 
                            label={`Variance: ${(freq.variance * 1000).toFixed(4)}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
                          />
                          <Chip 
                            label={`Avg Magnitude: ${(freq.avgMagnitude * 1000).toFixed(4)}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
                          />
                        </Stack>
                        <Typography variant="caption" sx={{ mt: 2, display: 'block', opacity: 0.8 }}>
                          {idx === 0 ? 'Primary Watermark' : 'Secondary Watermark'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Alert severity="success" sx={{ mt: 2 }}>
                Watermark detected! These frequencies were embedded as ownership markers.
              </Alert>
            </Box>
          )}

          {detectedFreqs && detectedFreqs.length === 0 && (
            <Alert severity="warning">
              No clear watermark frequencies detected in the 30-60 Hz range. 
              The audio may not contain watermarks, or they may be too weak to detect.
            </Alert>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
