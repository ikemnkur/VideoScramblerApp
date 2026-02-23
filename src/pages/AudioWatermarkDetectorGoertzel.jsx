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
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Upload,
  Search,
  GraphicEq,
  ContentCopy,
  Download,
  CheckCircle,
  TableChart,
  DataArray
} from '@mui/icons-material';

/**
 * Audio Watermark Detector (Goertzel Algorithm)
 * Detects and displays pulsing frequencies (30-60 Hz) using Goertzel algorithm
 */
export default function AudioWatermarkDetectorGoertzel() {
  const [audioFile, setAudioFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [detectedFreqs, setDetectedFreqs] = useState(null);
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [exportFormat, setExportFormat] = useState('csv');
  const [copiedStates, setCopiedStates] = useState({});

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

  /**
   * Goertzel algorithm - efficient detection of specific frequencies
   * @param {Float32Array} samples - Audio samples
   * @param {number} targetFreq - Target frequency to detect
   * @param {number} sampleRate - Sample rate of audio
   * @returns {number} Magnitude of the target frequency
   */
  const goertzel = (samples, targetFreq, sampleRate) => {
    const N = samples.length;
    const k = Math.round((N * targetFreq) / sampleRate);
    const w = (2 * Math.PI * k) / N;
    const cosine = Math.cos(w);
    const sine = Math.sin(w);
    const coeff = 2 * cosine;

    let q0 = 0;
    let q1 = 0;
    let q2 = 0;

    // Apply Goertzel algorithm
    for (let i = 0; i < N; i++) {
      q0 = coeff * q1 - q2 + samples[i];
      q2 = q1;
      q1 = q0;
    }

    // Calculate magnitude
    const real = q1 - q2 * cosine;
    const imag = q2 * sine;
    const magnitude = Math.sqrt(real * real + imag * imag) / N;

    return magnitude;
  };

  /**
   * Analyze frequencies using Goertzel algorithm with a sliding window.
   * Window size must be large enough for 1 Hz resolution: N >= sampleRate / 1Hz
   * At 44100 Hz, that's 44100 samples = 1 second.
   * We slide this window in 0.05s hops to preserve time resolution.
   * @param {AudioBuffer} audioBuffer - Audio buffer to analyze
   * @param {number} startTime - Start time of the HOP position in seconds
   * @param {number} windowDuration - Size of the analysis window in seconds (1.0 for 1 Hz resolution)
   * @returns {Array} Array of {freq, magnitude} objects
   */
  const analyzeFrequenciesGoertzel = (audioBuffer, startTime, windowDuration) => {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const numSamples = Math.floor(windowDuration * sampleRate);
    
    // Clamp to buffer bounds
    const actualStart = Math.min(startSample, audioBuffer.length - numSamples);
    const safeStart = Math.max(0, actualStart);
    
    // Get audio data (mix down to mono)
    const channelData = audioBuffer.getChannelData(0);
    const data = channelData.slice(safeStart, safeStart + numSamples);

    // Apply Hann window to reduce spectral leakage
    const windowedData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (data.length - 1)));
      windowedData[i] = data[i] * win;
    }

    const magnitudes = [];

    // Analyze every integer frequency from 30-60 Hz using Goertzel
    // With N = sampleRate * 1s, each bin is exactly 1 Hz apart
    for (let freq = 30; freq <= 60; freq++) {
      const magnitude = goertzel(windowedData, freq, sampleRate);
      magnitudes.push({ freq, magnitude });
    }

    return magnitudes;
  };

  // Detect pulsing frequencies using sliding 1-second window with 0.05s hops
  const detectPulsingFrequencies = (audioBuffer) => {
    // 1 second window gives 1 Hz frequency resolution (distinguishes each Hz)
    const windowDuration = 1.0;
    // 0.05s hop = 20 time samples per second over 20 seconds = 400 time points
    const hopDuration = 0.05;
    const analysisSpan = 20.0; // seconds to analyze
    const numHops = Math.floor(analysisSpan / hopDuration); // 400
    const allFreqData = [];

    for (let i = 0; i < numHops; i++) {
      const hopStart = i * hopDuration;
      // Center the window on the hop position for better time alignment
      const windowStart = Math.max(0, hopStart - windowDuration / 2);
      const magnitudes = analyzeFrequenciesGoertzel(audioBuffer, windowStart, windowDuration);
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
      const pulseRate = estimatePulseRate(freq.magnitudesOverTime, hopDuration);
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

      // Detect pulsing frequencies using Goertzel algorithm
      const result = detectPulsingFrequencies(audioBuffer);

      setDetectedFreqs(result.frequencies);
      setSpectrogramData(result.spectrogramData);

      console.log('Goertzel analysis complete:', result);

    } catch (err) {
      console.error('Error analyzing audio:', err);
      setError(`Error analyzing audio: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Export spectrogram data as CSV string
  const exportAsCSV = (data) => {
    if (!data || data.length === 0) return '';
    const freqs = data[0].map(bin => bin.freq);
    const numSegments = data.length;
    const hopDuration = 0.05;

    // Header row: time stamps
    const timeHeaders = Array.from({ length: numSegments }, (_, i) =>
      (i * hopDuration).toFixed(2) + 's'
    );
    const header = ['Freq (Hz)', ...timeHeaders].join(',');

    // One row per frequency
    const rows = freqs.map((freq, fIdx) => {
      const magnitudes = data.map(segment => segment[fIdx].magnitude.toExponential(4));
      return [freq, ...magnitudes].join(',');
    });

    return [header, ...rows].join('\n');
  };

  // Export spectrogram data as JSON array string
  const exportAsJSON = (data) => {
    if (!data || data.length === 0) return '';
    const hopDuration = 0.05;

    const output = data[0].map((bin, fIdx) => ({
      freq_hz: bin.freq,
      magnitudes: data.map((segment, tIdx) => ({
        time_s: parseFloat((tIdx * hopDuration).toFixed(2)),
        magnitude: parseFloat(segment[fIdx].magnitude.toExponential(4))
      }))
    }));

    return JSON.stringify(output, null, 2);
  };

  // Get the currently selected export text
  const getExportText = () => {
    if (!spectrogramData) return '';
    return exportFormat === 'csv' ? exportAsCSV(spectrogramData) : exportAsJSON(spectrogramData);
  };

  // Copy text to clipboard
  const handleCopy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download as file
  const handleDownloadExport = () => {
    const text = getExportText();
    const mimeType = exportFormat === 'csv' ? 'text/csv' : 'application/json';
    const ext = exportFormat === 'csv' ? 'csv' : 'json';
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watermark_spectrogram_${audioFile?.name?.replace(/\.[^/.]+$/, '') || 'export'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    const numFreqBins = spectrogramData[0].length; // 31 frequencies (30-60 Hz)
    
    // Reserve space for labels
    const leftMargin = 60;
    const rightMargin = 10;
    const topMargin = 10;
    const bottomMargin = 30;
    
    const graphWidth = width - leftMargin - rightMargin;
    const graphHeight = height - topMargin - bottomMargin;
    
    const segmentWidth = graphWidth / numTimeSegments;
    const freqRowHeight = graphHeight / numFreqBins; // Each frequency gets its own row

    // Find max magnitude for normalization
    let maxMagnitude = 0;
    spectrogramData.forEach(segment => {
      segment.forEach(bin => {
        maxMagnitude = Math.max(maxMagnitude, bin.magnitude);
      });
    });

    // Draw spectrogram - each frequency as a single horizontal line
    for (let t = 0; t < numTimeSegments; t++) {
      for (let f = 0; f < numFreqBins; f++) {
        const magnitude = spectrogramData[t][f].magnitude;
        const normalized = magnitude / maxMagnitude;
        
        // Color mapping: dark blue (low) to bright yellow/white (high)
        const hue = 240 - (normalized * 180); // 240 = blue, 60 = yellow
        const saturation = 100;
        const lightness = 15 + (normalized * 70);
        
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        const x = leftMargin + (t * segmentWidth);
        const y = topMargin + graphHeight - ((f + 1) * freqRowHeight); // Invert y-axis (30 Hz at bottom)
        
        ctx.fillRect(x, y, segmentWidth + 0.5, freqRowHeight + 0.5); // Slight overlap to avoid gaps
      }
    }

    // Draw frequency labels - every single Hz from 30-60
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let f = 0; f < numFreqBins; f++) {
      const freq = spectrogramData[0][f].freq;
      const y = topMargin + graphHeight - ((f + 0.5) * freqRowHeight);
      
      // Label every frequency
      ctx.fillStyle = '#ffffff';
      ctx.font = freq % 5 === 0 ? 'bold 11px monospace' : '10px monospace';
      ctx.fillText(`${freq} Hz`, leftMargin - 5, y);
      
      // Draw horizontal grid line
      ctx.strokeStyle = freq % 5 === 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = freq % 5 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width - rightMargin, y);
      ctx.stroke();
    }

    // Draw time labels and vertical grid lines (every 2 seconds, 0-20s)
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    const totalSeconds = 20;
    const tickInterval = 2; // label every 2 seconds
    for (let i = 0; i <= totalSeconds / tickInterval; i++) {
      const timeSec = i * tickInterval;
      const x = leftMargin + (timeSec / totalSeconds) * graphWidth;
      ctx.fillText(`${timeSec}s`, x, height - bottomMargin + 5);
      
      // Vertical grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, topMargin);
      ctx.lineTo(x, topMargin + graphHeight);
      ctx.stroke();
    }

    // Draw border around graph
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftMargin, topMargin, graphWidth, graphHeight);
  };

  // Draw magnitude over time graph for a specific frequency
  const drawMagnitudeGraph = (canvasId, magnitudesOverTime, freq, color) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const margin = 40;
    const graphWidth = width - margin * 2;
    const graphHeight = height - margin * 2;

    // Find max magnitude
    const maxMag = Math.max(...magnitudesOverTime);
    const minMag = Math.min(...magnitudesOverTime);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = margin + (i / 4) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }

    // Vertical grid lines (every 4 seconds, 0-20s)
    for (let i = 0; i <= 5; i++) {
      const timeSec = i * 4;
      const x = margin + (i / 5) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
      
      // Time label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${timeSec}s`, x, height - margin + 15);
    }

    // Draw magnitude line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < magnitudesOverTime.length; i++) {
      const x = margin + (i / (magnitudesOverTime.length - 1)) * graphWidth;
      const normalizedMag = (magnitudesOverTime[i] - minMag) / (maxMag - minMag || 1);
      const y = margin + graphHeight - (normalizedMag * graphHeight);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw title
    ctx.fillStyle = color;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${freq} Hz - Magnitude Over Time`, width / 2, 15);

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, margin, graphWidth, graphHeight);
  };

  // Effect to draw magnitude graphs when detected frequencies change
  useEffect(() => {
    if (detectedFreqs && detectedFreqs.length > 0) {
      detectedFreqs.forEach((freq, idx) => {
        const color = idx === 0 ? '#00ff88' : '#ff8800';
        drawMagnitudeGraph(`mag-graph-${idx}`, freq.magnitudesOverTime, freq.freq, color);
      });
    }
  }, [detectedFreqs]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <GraphicEq sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Audio Watermark Detector (Goertzel)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Detect inaudible ownership markers (30-60 Hz) using Goertzel algorithm
            </Typography>
            <Chip 
              label="Optimized for specific frequency detection" 
              color="secondary" 
              size="small" 
              sx={{ mt: 1 }}
            />
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
            color="secondary"
            startIcon={<Search />}
            onClick={analyzeAudio}
            disabled={!audioFile || analyzing}
            fullWidth
            sx={{ py: 1.5 }}
          >
            {analyzing ? 'Analyzing with Goertzel...' : 'Detect Watermark'}
          </Button>

          {/* Error */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Algorithm Info */}
          <Alert severity="info" icon={<GraphicEq />}>
            <Typography variant="body2">
              <strong>Goertzel Algorithm:</strong> More efficient than FFT when detecting specific frequencies. 
              This detector analyzes all 31 frequencies (30-60 Hz) individually with high precision.
            </Typography>
          </Alert>

          {/* Spectrogram */}
          {spectrogramData && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Frequency Spectrogram (30-60 Hz, 20 seconds) - Each Row = 1 Hz
              </Typography>
              <Box sx={{ 
                bgcolor: '#1a1a2e', 
                p: 2, 
                borderRadius: 1,
                overflow: 'auto'
              }}>
                <canvas
                  ref={canvasRef}
                  width={1000}
                  height={620}
                  style={{ 
                    width: '100%', 
                    height: 'auto',
                    maxWidth: '1000px',
                    display: 'block'
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Each horizontal row represents a single Hz (31 rows total). Brighter = higher magnitude. 
                Look for periodic brightness patterns (pulsing) at 2 pulses/sec or 1 pulse/sec.
              </Typography>
            </Box>
          )}

          {/* Export Data Card */}
          {spectrogramData && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Typography variant="h6">
                    Export Raw Data
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ToggleButtonGroup
                      value={exportFormat}
                      exclusive
                      onChange={(_, val) => val && setExportFormat(val)}
                      size="small"
                    >
                      <ToggleButton value="csv">
                        <TableChart sx={{ mr: 0.5, fontSize: 16 }} /> CSV
                      </ToggleButton>
                      <ToggleButton value="json">
                        <DataArray sx={{ mr: 0.5, fontSize: 16 }} /> JSON
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Tooltip title={copiedStates['export'] ? 'Copied!' : 'Copy to clipboard'}>
                      <IconButton
                        onClick={() => handleCopy('export', getExportText())}
                        color={copiedStates['export'] ? 'success' : 'default'}
                        size="small"
                      >
                        {copiedStates['export'] ? <CheckCircle /> : <ContentCopy />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download file">
                      <IconButton onClick={handleDownloadExport} size="small">
                        <Download />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {exportFormat === 'csv'
                    ? `${spectrogramData[0].length} frequencies × ${spectrogramData.length} time samples — rows = Hz, columns = time`
                    : `${spectrogramData[0].length} frequency objects, each with ${spectrogramData.length} time-magnitude pairs`
                  }
                </Typography>

                <Box
                  component="pre"
                  sx={{
                    bgcolor: '#0d0d1a',
                    color: '#00ff99',
                    p: 2,
                    borderRadius: 1,
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    maxHeight: 300,
                    whiteSpace: 'pre',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {getExportText().split('\n').slice(0, 40).join('\n')}
                  {getExportText().split('\n').length > 40 && (
                    `\n... (${getExportText().split('\n').length - 40} more rows — copy or download to see all)`
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Individual Magnitude Graphs for Detected Frequencies */}
          {detectedFreqs && detectedFreqs.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Pulse Pattern Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These graphs show the magnitude over time for each detected frequency. 
                Pulsing patterns appear as regular peaks.
              </Typography>
              <Grid container spacing={2}>
                {detectedFreqs.map((freq, idx) => (
                  <Grid item xs={12} key={idx}>
                    <Box sx={{ 
                      bgcolor: '#1a1a2e', 
                      p: 2, 
                      borderRadius: 1 
                    }}>
                      <canvas
                        id={`mag-graph-${idx}`}
                        width={800}
                        height={200}
                        style={{ 
                          width: '100%', 
                          height: 'auto',
                          maxWidth: '800px',
                          display: 'block'
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
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
                    <Card variant="outlined" sx={{ bgcolor: 'secondary.dark', color: 'white' }}>
                      <CardContent>
                        <Typography variant="h3" component="div" sx={{ mb: 1 }}>
                          {freq.freq} Hz
                        </Typography>
                        <Stack spacing={1}>
                            {/*  */}
                          <Chip 
                            label={`Pulse Rate: ~${freq.pulseRate} pulses/sec`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
                          />
                          <Chip 
                            label={`Variance: ${(freq.variance * 1000).toFixed(4)}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
                          />
                          <Chip 
                            label={`Avg Magnitude: ${(freq.avgMagnitude * 1000).toFixed(4)}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
                          />
                          <Chip 
                            label="Detected via Goertzel"
                            size="small"
                            color="success"
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.3)', color: 'white' }}
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
