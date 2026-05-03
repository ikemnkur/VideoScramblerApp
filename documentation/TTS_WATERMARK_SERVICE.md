# TTS Watermark Service Documentation

## Overview

The TTS (Text-to-Speech) Watermark Service is a background service that automatically generates and applies audio watermarks to scrambled and unscrambled audio files. It helps protect content and track usage by embedding user-specific voice tags.

## Architecture

### Components

1. **TTS Server** (`tts_server.py`)
   - Flask-based backend service
   - Uses `edge-tts` for high-quality speech synthesis
   - Runs on port `5001`
   - Handles watermark generation requests

2. **Client Service** (`src/utils/ttsWatermarkService.js`)
   - Frontend utility module
   - Manages watermark generation and application
   - Integrates with Web Audio API
   - Provides resampling and mixing functions

3. **Audio Scrambler Integration** (`src/pages/AudioScrambler.jsx`)
   - Prepends watermark at the START of audio
   - Format: "Protected audio by [username] on scrambler dot com"

4. **Audio Unscrambler Integration** (`src/pages/AudioUnscrambler.jsx`)
   - Overlays watermark at REGULAR INTERVALS throughout audio
   - Format: "Unscrambled by user [username] on scrambler dot com"
   - Interval: Auto-calculated (10-20 seconds based on duration)

## Features

### Scrambler Watermark (Prepended)
- ✅ Watermark added at the **beginning** of audio
- ✅ Included in scrambled output
- ✅ Helps identify content creator
- ✅ Survives scrambling process

### Unscrambler Watermark (Overlay)
- ✅ Watermark overlaid at **regular intervals**
- ✅ Applied after unscrambling
- ✅ Tracks who unscrambled the content
- ✅ Fade in/out for smooth integration
- ✅ Adjustable volume (default: 25%)

### Interval Calculation
```javascript
Audio Duration         Watermark Interval
≤ 30 seconds       →   Every 15 seconds
31-120 seconds     →   Every 20 seconds
> 120 seconds      →   Every 15 seconds
```

## Setup

### 1. Install Python Dependencies
```bash
pip install -r tts_requirements.txt
```

Required packages:
- `flask`
- `flask-cors`
- `edge-tts`
- `pydub`

### 2. Install System Dependencies
```bash
# For audio processing (required by pydub)
sudo apt-get install ffmpeg
```

### 3. Start TTS Server
```bash
# Start as background service
python tts_server.py

# Or use the startup script
bash start_tts_server.sh
```

Server will run on: `http://localhost:5001`

### 4. Verify Service
```bash
# Check health endpoint
curl http://localhost:5001/health

# Expected response:
# {"status": "ok", "service": "TTS Watermark Server"}
```

## API Endpoints

### TTS Server (`http://localhost:5001`)

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "TTS Watermark Server"
}
```

#### `GET /voices`
List available TTS voices.

**Response:**
```json
{
  "voices": [
    "en-US-AndrewNeural",
    "en-US-AriaNeural",
    "en-US-GuyNeural",
    "en-US-JennyNeural",
    "en-GB-RyanNeural",
    "en-GB-SoniaNeural"
  ]
}
```

#### `POST /generate-watermark`
Generate complete watermark with intro, username, and outro.

**Request Body:**
```json
{
  "intro": "Unscrambled by user",
  "id": "john_doe",
  "outro": "on scrambler dot com",
  "voice": "en-US-GuyNeural",
  "rate": "+15%",
  "pitch": "+0Hz",
  "silence_between": 150
}
```

**Response:**
```json
{
  "success": true,
  "url": "/audio/watermark_abc123.mp3",
  "filename": "watermark_abc123.mp3",
  "format": "mp3",
  "duration": 2.5,
  "size": 40960
}
```

#### `GET /audio/<filename>`
Serve generated audio files.

## Client API

### Import
```javascript
import { 
  generateWatermark, 
  loadAudioFromUrl, 
  prependWatermark,
  overlayWatermarkAtIntervals,
  checkTTSServerHealth 
} from '../utils/ttsWatermarkService';
```

### Functions

#### `generateWatermark(username, type, options)`
Generate TTS watermark audio.

**Parameters:**
- `username` (string): User's username
- `type` (string): `'scrambler'` or `'unscrambler'`
- `options` (object): Voice settings
  - `voice`: Voice name (default: `'en-US-GuyNeural'`)
  - `rate`: Speech rate (default: `'+10%'`)
  - `pitch`: Pitch adjustment (default: `'+0Hz'`)
  - `silence_between`: Silence in ms (default: `150`)

**Returns:** Promise<string> - URL to generated audio file

**Example:**
```javascript
const watermarkUrl = await generateWatermark('john_doe', 'scrambler', {
  voice: 'en-US-GuyNeural',
  rate: '+15%',
  pitch: '+0Hz'
});
```

#### `loadAudioFromUrl(url, audioContext)`
Load audio file and decode to AudioBuffer.

**Parameters:**
- `url` (string): URL to audio file
- `audioContext` (AudioContext): Web Audio API context

**Returns:** Promise<AudioBuffer>

**Example:**
```javascript
const watermarkBuffer = await loadAudioFromUrl(watermarkUrl, audioContext);
```

#### `prependWatermark(originalBuffer, watermarkBuffer, audioContext)`
Add watermark at the start of audio (for scrambler).

**Parameters:**
- `originalBuffer` (AudioBuffer): Original audio
- `watermarkBuffer` (AudioBuffer): Watermark audio
- `audioContext` (AudioContext): Web Audio API context

**Returns:** AudioBuffer - Combined audio with watermark at start

**Example:**
```javascript
const audioWithWatermark = prependWatermark(
  audioBuffer, 
  watermarkBuffer, 
  audioContext
);
```

#### `overlayWatermarkAtIntervals(originalBuffer, watermarkBuffer, audioContext, options)`
Overlay watermark at regular intervals (for unscrambler).

**Parameters:**
- `originalBuffer` (AudioBuffer): Original audio
- `watermarkBuffer` (AudioBuffer): Watermark audio
- `audioContext` (AudioContext): Web Audio API context
- `options` (object):
  - `intervalSeconds`: Interval between watermarks (auto-calculated if null)
  - `volume`: Watermark volume 0.0-1.0 (default: `0.3`)
  - `fadeMs`: Fade duration in ms (default: `200`)

**Returns:** AudioBuffer - Audio with watermark overlays

**Example:**
```javascript
const unscrambledWithWatermark = overlayWatermarkAtIntervals(
  recoveredBuffer,
  watermarkBuffer,
  audioContext,
  {
    intervalSeconds: null, // Auto-calculate
    volume: 0.25,
    fadeMs: 250
  }
);
```

#### `checkTTSServerHealth()`
Check if TTS server is available.

**Returns:** Promise<boolean>

**Example:**
```javascript
const isAvailable = await checkTTSServerHealth();
if (!isAvailable) {
  console.warn('TTS server not available');
}
```

## Integration Examples

### AudioScrambler Integration

```javascript
// In handleCreditConfirm function
try {
  // Generate watermark
  let watermarkBuffer = null;
  if (ttsAvailable && userData?.username) {
    const watermarkUrl = await generateWatermark(
      userData.username, 
      'scrambler',
      { voice: 'en-US-GuyNeural', rate: '+15%' }
    );
    watermarkBuffer = await loadAudioFromUrl(watermarkUrl, audioContext);
  }

  // Prepend to original audio
  let audioToProcess = audioBuffer;
  if (watermarkBuffer) {
    audioToProcess = prependWatermark(audioBuffer, watermarkBuffer, audioContext);
  }

  // Continue with scrambling...
  const shuffleResult = await applyAudioShuffling(audioToProcess, ...);
  // ...
}
```

### AudioUnscrambler Integration

```javascript
// In handleUnscrambleAudio function
try {
  // Unscramble audio
  let recoveredBuffer = scrambledAudioBuffer;
  // ... noise removal and unshuffling ...

  // Apply watermark overlays
  if (ttsAvailable && userData?.username) {
    const watermarkUrl = await generateWatermark(
      userData.username, 
      'unscrambler',
      { voice: 'en-US-GuyNeural', rate: '+15%' }
    );
    const watermarkBuffer = await loadAudioFromUrl(watermarkUrl, audioContext);
    
    recoveredBuffer = overlayWatermarkAtIntervals(
      recoveredBuffer,
      watermarkBuffer,
      audioContext,
      { intervalSeconds: null, volume: 0.25, fadeMs: 250 }
    );
  }

  // Continue with playback...
}
```

## Watermark Text Formats

### Scrambler
```
"Protected audio by [username] on scrambler dot com"
```

Example: "Protected audio by john_doe on scrambler dot com"

### Unscrambler
```
"Unscrambled by user [username] on scrambler dot com"
```

Example: "Unscrambled by user john_doe on scrambler dot com"

## Technical Details

### Audio Processing

1. **Sample Rate Matching**: Watermarks are automatically resampled to match the target audio's sample rate
2. **Channel Handling**: Mono watermarks are duplicated to stereo if needed
3. **Clipping Prevention**: Audio levels are normalized to prevent distortion
4. **Fade Effects**: Smooth fade in/out applied to watermark overlays

### Performance

- Watermark generation: ~500ms per watermark
- Audio mixing: Real-time (depends on audio length)
- Memory usage: Minimal (uses streaming where possible)
- File cleanup: Auto-delete files older than 1 hour

### Error Handling

The system gracefully degrades if TTS server is unavailable:
- ✅ Checks server health on component mount
- ✅ Continues without watermark if server is down
- ✅ Logs warnings but doesn't block user flow
- ✅ Shows info toast when generating watermarks

## Troubleshooting

### TTS Server Not Starting

**Problem:** `ModuleNotFoundError: No module named 'edge_tts'`

**Solution:**
```bash
pip install -r tts_requirements.txt
```

### FFmpeg Missing

**Problem:** `FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'`

**Solution:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

### Port Already in Use

**Problem:** `Address already in use: Port 5001`

**Solution:**
```bash
# Find process using port 5001
lsof -i :5001

# Kill the process
kill -9 <PID>

# Or use a different port
python tts_server.py  # Edit port in file
```

### CORS Errors

**Problem:** `Access-Control-Allow-Origin error`

**Solution:**
- Ensure TTS server is running
- Check `CORS(app)` is enabled in `tts_server.py`
- Verify frontend URL is `http://localhost:5173`

### Watermarks Not Applied

**Problem:** Audio plays but no watermark heard

**Solution:**
1. Check TTS server is running: `curl http://localhost:5001/health`
2. Check browser console for errors
3. Verify `ttsAvailable` state is `true`
4. Increase watermark volume in code

### Audio Quality Issues

**Problem:** Watermark sounds distorted

**Solution:**
- Reduce watermark volume (default: 0.25)
- Increase fade duration (fadeMs: 250+)
- Check for clipping in browser DevTools

## Advanced Configuration

### Custom Voice Settings

```javascript
// Faster, higher pitch
const watermarkUrl = await generateWatermark(username, 'unscrambler', {
  voice: 'en-US-AriaNeural',
  rate: '+25%',
  pitch: '+5Hz'
});

// Slower, deeper voice
const watermarkUrl = await generateWatermark(username, 'scrambler', {
  voice: 'en-US-AndrewNeural',
  rate: '-10%',
  pitch: '-10Hz'
});
```

### Custom Interval Logic

```javascript
// Fixed 10-second intervals
recoveredBuffer = overlayWatermarkAtIntervals(
  recoveredBuffer,
  watermarkBuffer,
  audioContext,
  { intervalSeconds: 10 }
);

// More frequent for short audio
const interval = duration < 60 ? 10 : 20;
recoveredBuffer = overlayWatermarkAtIntervals(
  recoveredBuffer,
  watermarkBuffer,
  audioContext,
  { intervalSeconds: interval }
);
```

### Watermark Volume Adjustment

```javascript
// Louder watermark (50% volume)
overlayWatermarkAtIntervals(buffer, watermark, ctx, { volume: 0.5 });

// Quieter watermark (15% volume)
overlayWatermarkAtIntervals(buffer, watermark, ctx, { volume: 0.15 });
```

## Production Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/tts-watermark.service`:

```ini
[Unit]
Description=TTS Watermark Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/VideoScramblerApp
ExecStart=/usr/bin/python3 /path/to/VideoScramblerApp/tts_server.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable tts-watermark
sudo systemctl start tts-watermark
sudo systemctl status tts-watermark
```

### Docker Deployment

```dockerfile
FROM python:3.10-slim

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY tts_requirements.txt .
RUN pip install -r tts_requirements.txt

COPY tts_server.py .
RUN mkdir public_audio

EXPOSE 5001
CMD ["python", "tts_server.py"]
```

Build and run:
```bash
docker build -t tts-watermark .
docker run -d -p 5001:5001 --name tts-watermark tts-watermark
```

## Security Considerations

1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **Authentication**: Consider adding API keys for production
3. **File Cleanup**: Automatic cleanup after 1 hour
4. **Input Validation**: Sanitize usernames before TTS generation
5. **CORS**: Restrict to known domains in production

## License

Part of VideoScramblerApp - Proprietary

## Support

For issues or questions:
- Check logs: `tail -f tts_server.log`
- Server health: `http://localhost:5001/health`
- Browser console: Look for TTS-related errors
