import { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  LinearProgress,
  Stack,
  Chip,
  Divider
} from '@mui/material';
import {
  Upload,
  Download,
  WaterDrop,
  Refresh
} from '@mui/icons-material';

/**
 * Audio Watermark Encoder
 * Adds two pulsing inaudible frequencies (30-60 Hz) to audio files
 * for ownership verification
 */
export default function AudioWatermarkEncoder() {
  const [audioFile, setAudioFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [watermarkData, setWatermarkData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [watermarkedUrl, setWatermarkedUrl] = useState(null);

  const audioContextRef = useRef(null);
  const fileInputRef = useRef(null);

  // Generate random frequency between 30-60 Hz
  const generateFrequency = () => {
    return Math.floor(Math.random() * (60 - 30 + 1)) + 30;
  };

  // Generate new random watermark frequencies (3 freqs, all >= 5 Hz apart)
  const generateWatermark = () => {
    const pickFreq = (existing = []) => {
      let freq;
      let attempts = 0;
      do {
        freq = Math.floor(Math.random() * (60 - 30 + 1)) + 30;
        attempts++;
        if (attempts > 500) break;
      } while (existing.some(f => Math.abs(f - freq) < 5));
      return freq;
    };

    const freq1 = pickFreq();
    const freq2 = pickFreq([freq1]);
    const freq3 = pickFreq([freq1, freq2]);

    setWatermarkData({
      freq1,
      freq2,
      freq3,
      pulseRate1: 0.125,   // 0.125 pulses per second (1 pulse every 8 seconds)
      pulseRate2: 0.25,   // 0.25 pulses per second (1 pulse every 4 seconds)
      pulseRate3: 0.5  // 0.5 pulses per second (1 pulse every 2 seconds)
    });
  };

  // Create a pulsing tone buffer
  const createPulsingTone = (audioContext, frequency, pulseRate, duration) => {
    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        
        // Generate sine wave at target frequency
        const sineWave = Math.sin(2 * Math.PI * frequency * time);
        
        // Create pulse envelope (0 to 1) using sine wave
        const pulseEnvelope = (Math.sin(2 * Math.PI * pulseRate * time) + 1) / 2;
        
        // Apply pulse envelope to sine wave with low amplitude (0.02 = -34dB)
        data[i] = sineWave * pulseEnvelope * 0.2;
      }
    }

    return buffer;
  };

  // Mix watermark tones with original audio
  const mixAudioBuffers = (originalBuffer, tone1Buffer, tone2Buffer, tone3Buffer) => {
    const sampleRate = originalBuffer.sampleRate;
    const channels = originalBuffer.numberOfChannels;
    const length = originalBuffer.length;

    const mixedBuffer = audioContextRef.current.createBuffer(channels, length, sampleRate);

    for (let channel = 0; channel < channels; channel++) {
      const originalData = originalBuffer.getChannelData(channel);
      const mixedData = mixedBuffer.getChannelData(channel);
      const tone1Data = tone1Buffer.getChannelData(Math.min(channel, 1));
      const tone2Data = tone2Buffer.getChannelData(Math.min(channel, 1));
      const tone3Data = tone3Buffer.getChannelData(Math.min(channel, 1));

      for (let i = 0; i < length; i++) {
        mixedData[i] = originalData[i] + tone1Data[i] + tone2Data[i] + tone3Data[i];
        mixedData[i] = Math.max(-1, Math.min(1, mixedData[i]));
      }
    }

    return mixedBuffer;
  };

  // Convert AudioBuffer to WAV blob
  const audioBufferToWav = (audioBuffer) => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numberOfChannels * 2;

    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write audio data
    const channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      setError('');
      setWatermarkedUrl(null);
      
      // Generate watermark frequencies if not already generated
      if (!watermarkData) {
        generateWatermark();
      }
    } else {
      setError('Please upload a valid audio file');
    }
  };

  // Process audio and add watermark
  const processAudio = async () => {
    if (!audioFile || !watermarkData) {
      setError('Please upload an audio file and generate watermark frequencies');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setError('');

    try {
      // Initialize audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      setProgress(10);

      // Read audio file
      const arrayBuffer = await audioFile.arrayBuffer();
      setProgress(30);

      // Decode audio
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      setProgress(50);

      const duration = audioBuffer.duration;

      // Create pulsing watermark tones
      const tone1 = createPulsingTone(
        audioContextRef.current,
        watermarkData.freq1,
        watermarkData.pulseRate1,
        duration
      );
      setProgress(55);

      const tone2 = createPulsingTone(
        audioContextRef.current,
        watermarkData.freq2,
        watermarkData.pulseRate2,
        duration
      );
      setProgress(65);

      const tone3 = createPulsingTone(
        audioContextRef.current,
        watermarkData.freq3,
        watermarkData.pulseRate3,
        duration
      );
      setProgress(75);

      // Mix original audio with all three watermark tones
      const watermarkedBuffer = mixAudioBuffers(audioBuffer, tone1, tone2, tone3);
      setProgress(85);

      // Convert to WAV
      const wavBlob = audioBufferToWav(watermarkedBuffer);
      setProgress(95);

      // Create download URL
      const url = URL.createObjectURL(wavBlob);
      setWatermarkedUrl(url);
      setProgress(100);

      console.log('Watermark applied successfully:', {
        freq1: watermarkData.freq1,
        freq2: watermarkData.freq2,
        freq3: watermarkData.freq3,
        duration: duration
      });

    } catch (err) {
      console.error('Error processing audio:', err);
      setError(`Error processing audio: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Download watermarked file
  const handleDownload = () => {
    if (watermarkedUrl) {
      const a = document.createElement('a');
      a.href = watermarkedUrl;
      a.download = `watermarked_${audioFile.name.replace(/\.[^/.]+$/, '')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <WaterDrop sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Audio Watermark Encoder
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add inaudible ownership markers to your audio files
            </Typography>
          </Box>

          <Divider />

          {/* Watermark Frequencies */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Watermark Frequencies
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={generateWatermark}
                disabled={processing}
              >
                Generate New
              </Button>
              {watermarkData && (
                <>
                  <Chip 
                    label={`Freq 1: ${watermarkData.freq1} Hz @ ${watermarkData.pulseRate1} Hz pulse`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip 
                    label={`Freq 2: ${watermarkData.freq2} Hz @ ${watermarkData.pulseRate2} Hz pulse`}
                    color="secondary"
                    variant="outlined"
                  />
                  <Chip 
                    label={`Freq 3: ${watermarkData.freq3} Hz @ ${watermarkData.pulseRate3} Hz pulse`}
                    color="warning"
                    variant="outlined"
                  />
                </>
              )}
            </Stack>
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              3 inaudible frequencies (30-60 Hz), each at least 5 Hz apart.
              Pulse rates: 2 Hz, 1 Hz, and 0.5 Hz (1 pulse every 2 seconds).
            </Alert>
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
                disabled={processing}
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

          {/* Process Button */}
          <Button
            variant="contained"
            size="large"
            onClick={processAudio}
            disabled={!audioFile || !watermarkData || processing}
            fullWidth
            sx={{ py: 1.5 }}
          >
            {processing ? 'Processing...' : 'Add Watermark'}
          </Button>

          {/* Progress */}
          {processing && (
            <Box>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Progress: {progress}%
              </Typography>
            </Box>
          )}

          {/* Error */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Download */}
          {watermarkedUrl && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Watermark applied successfully! The audio now contains your ownership markers.
              </Alert>
              <Button
                variant="contained"
                color="success"
                startIcon={<Download />}
                onClick={handleDownload}
                fullWidth
                size="large"
              >
                Download Watermarked Audio
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Save these frequencies for verification: {watermarkData.freq1} Hz, {watermarkData.freq2} Hz, and {watermarkData.freq3} Hz
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
