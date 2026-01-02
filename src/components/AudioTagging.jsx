import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Alert,
  CircularProgress,
  Grid,
  Divider
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Download,
  VolumeUp,
  Refresh
} from '@mui/icons-material';

const TTS_SERVER_URL = 'http://localhost:5001';

const AudioTagging = () => {
  // State management
  const [intro, setIntro] = useState('Unscrambled by');
  const [id, setId] = useState('');
  const [outro, setOutro] = useState('on scrambler.com');
  const [voice, setVoice] = useState('en-US-AndrewNeural');
  const [rate, setRate] = useState(0);
  const [interval, setInterval] = useState(30);
  const [fade, setFade] = useState(1);
  const [volume, setVolume] = useState(0.5);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  
  // Audio state
  const [watermarkBuffer, setWatermarkBuffer] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [originalBuffer, setOriginalBuffer] = useState(null);
  const [watermarkedBuffer, setWatermarkedBuffer] = useState(null);
  const [isPlayingWatermark, setIsPlayingWatermark] = useState(false);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingWatermarked, setIsPlayingWatermarked] = useState(false);
  
  // Refs
  const watermarkSourceRef = useRef(null);
  const originalSourceRef = useRef(null);
  const watermarkedSourceRef = useRef(null);
  const audioContextRef = useRef(null);
  const watermarkCanvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const watermarkedCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    checkServerHealth();
    fetchAvailableVoices();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Check TTS server health
  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${TTS_SERVER_URL}/health`);
      if (response.ok) {
        setServerStatus('online');
        setSuccess('TTS server is online');
      } else {
        setServerStatus('offline');
        setError('TTS server is not responding');
      }
    } catch (err) {
      setServerStatus('offline');
      setError('TTS server is not running. Please start it with: python tts_server.py');
    }
  };

  // Fetch available voices from server
  const fetchAvailableVoices = async () => {
    // Default voices
    const defaultVoices = [
      'en-US-AndrewNeural',
      'en-US-AriaNeural',
      'en-US-GuyNeural',
      'en-US-JennyNeural',
      'en-GB-RyanNeural',
      'en-GB-SoniaNeural'
    ];

    try {
      const response = await fetch(`${TTS_SERVER_URL}/voices`);
      if (response.ok) {
        const data = await response.json();
        // Ensure voices is an array
        if (Array.isArray(data.voices)) {
          setAvailableVoices(data.voices);
        } else {
          setAvailableVoices(defaultVoices);
        }
      } else {
        setAvailableVoices(defaultVoices);
      }
    } catch (err) {
      console.error('Failed to fetch voices:', err);
      setAvailableVoices(defaultVoices);
    }
  };

  // Generate watermark from TTS server
  const generateWatermarkFromServer = async () => {
    if (!intro && !id && !outro) {
      setError('Please enter at least one text field (intro, ID, or outro)');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${TTS_SERVER_URL}/generate-watermark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intro: intro,
          id: id,
          outro: outro,
          voice: voice,
          rate: `${rate > 0 ? '+' : ''}${rate}%`,
          pitch: '+0Hz',
          silence_between: 150
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate watermark from server');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate watermark');
      }

      // Fetch the audio file from the URL
      const audioUrl = `${TTS_SERVER_URL}${data.url}`;
      const audioResponse = await fetch(audioUrl);
      
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch generated audio file');
      }

      const arrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      setWatermarkBuffer(audioBuffer);
      
      // Draw waveform
      if (watermarkCanvasRef.current) {
        drawWaveform(audioBuffer, watermarkCanvasRef.current);
      }

      setSuccess(`Watermark generated successfully! Duration: ${data.duration.toFixed(2)}s`);
    } catch (err) {
      setError(`Error generating watermark: ${err.message}`);
      console.error('Watermark generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setOriginalFile(file);
    setError('');
    setSuccess('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      setOriginalBuffer(audioBuffer);

      if (originalCanvasRef.current) {
        drawWaveform(audioBuffer, originalCanvasRef.current);
      }

      setSuccess(`Loaded: ${file.name}`);
    } catch (err) {
      setError(`Error loading audio file: ${err.message}`);
    }
  };

  // Apply watermark to original audio
  const applyWatermark = async () => {
    if (!watermarkBuffer) {
      setError('Please generate a watermark first');
      return;
    }

    if (!originalBuffer) {
      setError('Please upload an audio file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const watermarked = await renderWatermarkedAudio(
        originalBuffer,
        watermarkBuffer,
        interval,
        fade,
        volume
      );

      setWatermarkedBuffer(watermarked);

      if (watermarkedCanvasRef.current) {
        drawWaveform(watermarked, watermarkedCanvasRef.current);
      }

      setSuccess('Watermark applied successfully!');
    } catch (err) {
      setError(`Error applying watermark: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Render watermarked audio using OfflineAudioContext
  const renderWatermarkedAudio = async (originalBuffer, watermarkBuffer, intervalSeconds, fadeDuration, watermarkVolume) => {
    const sampleRate = originalBuffer.sampleRate;
    const numChannels = originalBuffer.numberOfChannels;
    const duration = originalBuffer.duration;
    
    const offlineContext = new OfflineAudioContext(
      numChannels,
      Math.ceil(duration * sampleRate),
      sampleRate
    );

    // Create source for original audio
    const originalSource = offlineContext.createBufferSource();
    originalSource.buffer = originalBuffer;
    originalSource.connect(offlineContext.destination);
    originalSource.start(0);

    // Add watermark at intervals
    const watermarkDuration = watermarkBuffer.duration;
    let currentTime = 0;

    while (currentTime < duration) {
      const watermarkSource = offlineContext.createBufferSource();
      watermarkSource.buffer = watermarkBuffer;

      const gainNode = offlineContext.createGain();
      watermarkSource.connect(gainNode);
      gainNode.connect(offlineContext.destination);

      // Set initial volume
      gainNode.gain.setValueAtTime(0, currentTime);
      
      // Fade in
      gainNode.gain.linearRampToValueAtTime(
        watermarkVolume,
        currentTime + fadeDuration
      );

      // Fade out
      const fadeOutStart = currentTime + watermarkDuration - fadeDuration;
      if (fadeOutStart > currentTime + fadeDuration) {
        gainNode.gain.setValueAtTime(watermarkVolume, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + watermarkDuration);
      }

      watermarkSource.start(currentTime);

      currentTime += intervalSeconds;
    }

    return await offlineContext.startRendering();
  };

  // Draw waveform on canvas
  const drawWaveform = (audioBuffer, canvas) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#2196f3';
    ctx.beginPath();
    ctx.moveTo(0, amp);

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step; j++) {
        const datum = channelData[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      ctx.lineTo(i, (1 + min) * amp);
    }

    for (let i = width - 1; i >= 0; i--) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step; j++) {
        const datum = channelData[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.closePath();
    ctx.fill();
  };

  // Play audio buffer
  const playAudioBuffer = (buffer, sourceRef, setIsPlaying) => {
    if (!buffer || !audioContextRef.current) return;

    // Stop if already playing
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
      setIsPlaying(false);
      return;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      sourceRef.current = null;
      setIsPlaying(false);
    };

    source.start(0);
    sourceRef.current = source;
    setIsPlaying(true);
  };

  // Download audio buffer as WAV
  const downloadAudio = (buffer, filename) => {
    if (!buffer) return;

    const wav = audioBufferToWav(buffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const samples = buffer.length;
    const dataSize = samples * blockAlign;
    
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write audio data
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  return (
    <Container maxWidth="lg" style={{ paddingTop: 32, paddingBottom: 32 }}>
      <Paper elevation={3} sx={{ p: 4 }} style={{ backgroundColor: "#001018" }}>
        <Typography variant="h4" gutterBottom align="center" sx={{ mb: 3 }}>
          Audio Watermarking with TTS
        </Typography>

        {/* Server Status */}
        <Box sx={{ mb: 3 }}>
          <Alert 
            severity={serverStatus === 'online' ? 'success' : 'warning'}
            action={
              <Button color="inherit" size="small" onClick={checkServerHealth}>
                <Refresh />
              </Button>
            }
          >
            TTS Server: {serverStatus === 'online' ? 'Online' : 'Offline'}
          </Alert>
        </Box>

        {/* Error and Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Watermark Configuration */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            1. Configure Watermark Text
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Intro Text"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="e.g., Unscrambled by"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="ID/Username"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g., USER 4821"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Outro Text"
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                placeholder="e.g., on scram-blur.com"
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Voice</InputLabel>
                <Select
                  value={voice}
                  label="Voice"
                  onChange={(e) => setVoice(e.target.value)}
                >
                  {Array.isArray(availableVoices) && availableVoices.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Speech Rate: {rate > 0 ? '+' : ''}{rate}%</Typography>
              <Slider
                value={rate}
                onChange={(e, value) => setRate(value)}
                min={-50}
                max={50}
                step={5}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={generateWatermarkFromServer}
              disabled={loading || serverStatus === 'offline'}
              startIcon={loading ? <CircularProgress size={20} /> : <VolumeUp />}
            >
              {loading ? 'Generating...' : 'Generate Watermark Audio'}
            </Button>
          </Box>
        </Box>

        {/* Watermark Preview */}
        {watermarkBuffer && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Watermark Preview
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <canvas
                ref={watermarkCanvasRef}
                width={800}
                height={100}
                style={{ width: '100%', height: '100px', display: 'block' }}
              />
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => playAudioBuffer(watermarkBuffer, watermarkSourceRef, setIsPlayingWatermark)}
                  startIcon={isPlayingWatermark ? <Stop /> : <PlayArrow />}
                >
                  {isPlayingWatermark ? 'Stop' : 'Play'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => downloadAudio(watermarkBuffer, 'watermark.wav')}
                  startIcon={<Download />}
                >
                  Download
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        <Divider sx={{ my: 4 }} />

        {/* Upload Original Audio */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            2. Upload Original Audio
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <Button
            variant="contained"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose Audio File
          </Button>
          {originalFile && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Selected: {originalFile.name}
            </Typography>
          )}
        </Box>

        {/* Original Audio Preview */}
        {originalBuffer && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Original Audio
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <canvas
                ref={originalCanvasRef}
                width={800}
                height={100}
                style={{ width: '100%', height: '100px', display: 'block' }}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => playAudioBuffer(originalBuffer, originalSourceRef, setIsPlayingOriginal)}
                  startIcon={isPlayingOriginal ? <Stop /> : <PlayArrow />}
                >
                  {isPlayingOriginal ? 'Stop' : 'Play'}
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Watermark Settings */}
        {watermarkBuffer && originalBuffer && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              3. Configure Watermark Application
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Interval: {interval}s</Typography>
                <Slider
                  value={interval}
                  onChange={(e, value) => setInterval(value)}
                  min={10}
                  max={120}
                  step={5}
                  marks
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Fade Duration: {fade}s</Typography>
                <Slider
                  value={fade}
                  onChange={(e, value) => setFade(value)}
                  min={0}
                  max={5}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Volume: {(volume * 100).toFixed(0)}%</Typography>
                <Slider
                  value={volume}
                  onChange={(e, value) => setVolume(value)}
                  min={0}
                  max={1}
                  step={0.05}
                  valueLabelDisplay="auto"
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={applyWatermark}
                disabled={loading}
                color="success"
                startIcon={loading ? <CircularProgress size={20} /> : <VolumeUp />}
              >
                {loading ? 'Processing...' : 'Apply Watermark'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Watermarked Audio Result */}
        {watermarkedBuffer && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Watermarked Audio
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <canvas
                ref={watermarkedCanvasRef}
                width={800}
                height={100}
                style={{ width: '100%', height: '100px', display: 'block' }}
              />
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => playAudioBuffer(watermarkedBuffer, watermarkedSourceRef, setIsPlayingWatermarked)}
                  startIcon={isPlayingWatermarked ? <Stop /> : <PlayArrow />}
                >
                  {isPlayingWatermarked ? 'Stop' : 'Play'}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => downloadAudio(watermarkedBuffer, 'watermarked_audio.wav')}
                  startIcon={<Download />}
                >
                  Download Watermarked Audio
                </Button>
              </Box>
            </Paper>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default AudioTagging;
