# TTS Server - File-Based Architecture

## Summary of Changes

The TTS server has been redesigned to use a **file-based architecture** instead of returning large base64-encoded audio data in JSON responses. This improves performance, reliability, and reduces memory usage.

## What Changed

### Backend (tts_server.py)

1. **File Storage**: Audio files are now saved to a `public_audio/` directory
2. **URL-Based Response**: Endpoints return file URLs instead of base64 data
3. **Automatic Cleanup**: Old files (>1 hour) are automatically deleted on health checks
4. **Simplified API**: Cleaner response format with metadata

### Frontend (AudioTagging.jsx)

1. **Two-Step Fetch**: First gets URL from API, then fetches audio file
2. **Removed base64 Handling**: No more base64 decoding logic needed
3. **Better Error Handling**: Separate error handling for API and file fetch

## New API Response Format

### Before (Base64):
```json
{
  "success": true,
  "audio": "data:audio/mpeg;base64,SUQzBAA...[huge string]",
  "format": "mp3"
}
```

### After (File URL):
```json
{
  "success": true,
  "url": "/audio/watermark_14a377db04074b018be917f8cc01dc7e.mp3",
  "filename": "watermark_14a377db04074b018be917f8cc01dc7e.mp3",
  "format": "mp3",
  "duration": 6.348,
  "size": 128685
}
```

## Benefits

### Performance
- ✅ **Smaller JSON responses** - No base64 bloat (33% overhead eliminated)
- ✅ **Faster API responses** - Server returns immediately after saving file
- ✅ **Browser-native decoding** - Let the browser handle audio decoding efficiently
- ✅ **Streaming support** - Files can be streamed directly to audio elements

### Reliability
- ✅ **No memory issues** - Large audio files don't cause JSON parsing errors
- ✅ **Better error handling** - Separate API and file fetch errors
- ✅ **Retry capability** - Can retry file fetch without regenerating audio

### Scalability
- ✅ **CDN-ready** - Files can be served by CDN or static file server
- ✅ **Caching support** - Standard HTTP caching headers work
- ✅ **Load balancing** - Easy to separate file serving from API

## How It Works

### 1. Generate Watermark
```javascript
// Frontend request
const response = await fetch('http://localhost:5001/generate-watermark', {
  method: 'POST',
  body: JSON.stringify({
    intro: "Unscrambled by",
    id: "USER 4821",
    outro: "on scramblurr.com",
    voice: "en-US-AndrewNeural"
  })
});

const data = await response.json();
// data.url = "/audio/watermark_xxx.mp3"
```

### 2. Fetch Audio File
```javascript
// Fetch the actual audio file
const audioUrl = `http://localhost:5001${data.url}`;
const audioResponse = await fetch(audioUrl);
const arrayBuffer = await audioResponse.arrayBuffer();

// Decode with Web Audio API
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
```

### 3. Use Audio
```javascript
// Play, process, or apply watermark as needed
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start();
```

## File Management

### Storage Location
- Directory: `public_audio/` (in project root)
- Format: `watermark_<uuid>.mp3` or `speech_<uuid>.mp3`
- Permissions: Readable by Flask server

### Automatic Cleanup
- Files older than 1 hour are deleted automatically
- Cleanup runs on every health check (`GET /health`)
- No manual intervention needed

### Security Considerations
- Files use random UUIDs - not guessable
- Files auto-expire after 1 hour
- No user-uploaded content is stored (only generated audio)

## Testing

### Test Watermark Generation
```bash
curl -X POST http://localhost:5001/generate-watermark \
  -H "Content-Type: application/json" \
  -d '{
    "intro": "Unscrambled by",
    "id": "USER 4821",
    "outro": "on scramblurr.com",
    "voice": "en-US-AndrewNeural",
    "rate": "+0%"
  }'
```

Expected response:
```json
{
  "success": true,
  "url": "/audio/watermark_xxx.mp3",
  "filename": "watermark_xxx.mp3",
  "duration": 6.348,
  "format": "mp3",
  "size": 128685
}
```

### Test File Access
```bash
# Get the URL from previous response
curl http://localhost:5001/audio/watermark_xxx.mp3 --output test.mp3
```

### Test in Browser
1. Start TTS server: `python tts_server.py`
2. Navigate to `/audio-tagging` in your app
3. Enter watermark text and click "Generate Watermark Audio"
4. Audio waveform should appear within 2-3 seconds

## Updated Endpoints

### GET /audio/<filename>
**New endpoint** - Serves audio files from `public_audio/` directory

```bash
GET http://localhost:5001/audio/watermark_xxx.mp3
```

### POST /generate-speech
Returns URL instead of base64:
```json
{
  "success": true,
  "url": "/audio/speech_xxx.mp3",
  "filename": "speech_xxx.mp3",
  "format": "mp3",
  "duration": 2.5,
  "size": 48923
}
```

### POST /generate-watermark
Returns URL with metadata:
```json
{
  "success": true,
  "url": "/audio/watermark_xxx.mp3",
  "filename": "watermark_xxx.mp3",
  "format": "mp3",
  "duration": 6.348,
  "size": 128685
}
```

## Migration Notes

### If You Have Old Code
If you have other code using the old base64 format:

1. **Update fetch logic**:
   ```javascript
   // OLD
   const { audio } = await response.json();
   const buffer = await base64ToAudioBuffer(audio);
   
   // NEW
   const { url } = await response.json();
   const audioResponse = await fetch(`${TTS_SERVER_URL}${url}`);
   const arrayBuffer = await audioResponse.arrayBuffer();
   const buffer = await audioContext.decodeAudioData(arrayBuffer);
   ```

2. **Remove base64 utilities**: Delete any `base64ToAudioBuffer` functions

3. **Update error handling**: Handle two possible fetch failures

## Troubleshooting

### "Failed to fetch generated audio file"
- Check that TTS server is running: `curl http://localhost:5001/health`
- Verify file exists: `ls -la public_audio/`
- Check server console for errors

### "CORS error"
- Ensure `flask-cors` is installed: `pip install flask-cors`
- CORS is already enabled in `tts_server.py`

### "No such file or directory"
- `public_audio/` directory is created automatically on server start
- If missing, restart server: `python tts_server.py`

### Files not cleaning up
- Cleanup runs on health checks
- Manual cleanup: `rm -rf public_audio/*.mp3`
- Check server has write permissions

## Production Considerations

For production deployment:

1. **Use a proper web server** (nginx, Apache) to serve `public_audio/`
2. **Enable HTTPS** for secure file delivery
3. **Configure CORS** properly for your domain
4. **Set up scheduled cleanup** with cron instead of on-demand
5. **Monitor disk usage** - set file size limits
6. **Use a CDN** for better performance and global delivery
7. **Rate limit** the generation endpoints

## Next Steps

- [ ] Add file upload endpoint for applying watermarks to user audio
- [ ] Implement batch generation for multiple watermarks
- [ ] Add WebSocket support for real-time progress updates
- [ ] Create audio preview endpoint (first 10 seconds)
- [ ] Add metadata endpoints (get duration, format, etc.)
