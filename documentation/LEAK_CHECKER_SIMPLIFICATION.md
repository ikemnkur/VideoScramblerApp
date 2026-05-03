# Leak Checker Components Simplification

## Overview

All three leak checker components (Audio, Photo, Video) have been refactored to use a consistent, simplified dual-file upload pattern for better user experience and backend comparison capabilities.

## Changes Summary

### Common Pattern Applied to All Three Components

#### 1. **Dual File Upload System**
- **Before:** Single file upload for "leaked" content
- **After:** Separate upload sections for:
  - **Original File** (green-themed) - The unscrambled original content
  - **Leaked File** (orange-themed) - The suspected leaked content

#### 2. **State Management**
**Removed States:**
- `selectedFile`
- `previewUrl`
- `decodedParams` (Video/Photo)
- `unscrambleParams` (Video/Photo)
- Complex waveform-related states (Audio)

**Added States:**
- `originalAudioFile` / `originalImageFile` / `originalVideoFile`
- `leakedAudioFile` / `leakedImageFile` / `leakedVideoFile`
- `originalPreviewUrl` / `leakedPreviewUrl`
- `loadedKeyData` (simplified key handling)

#### 3. **File Handlers**
**Replaced:**
- `handleFileSelect()` → split into two handlers:
  - `handleOriginalFileSelect(event)` - handles original file upload
  - `handleLeakedFileSelect(event)` - handles leaked file upload

**Enhanced:**
- `handleKeyFileSelect(event)` - simplified key file loading with XOR decryption

#### 4. **UI Layout Changes**

**Material-UI Grid System:**
```jsx
<Grid container spacing={3}>
  <Grid item xs={12} md={6}>
    {/* Original File Upload (Green) */}
  </Grid>
  <Grid item xs={12} md={6}>
    {/* Leaked File Upload (Orange) */}
  </Grid>
</Grid>
```

**Side-by-Side Previews:**
- Audio: Dual HTML5 audio players with waveforms removed
- Photo: Dual image previews with zoom capability
- Video: Dual video players with controls

#### 5. **Backend Integration**

**FormData Structure:**
```javascript
const formData = new FormData();
formData.append('originalAudio/Image/Video', originalFile);
formData.append('leakedAudio/Image/Video', leakedFile);

// Optional key data
if (loadedKeyData) {
  formData.append('keyData', JSON.stringify(loadedKeyData));
} else if (keyCode.trim()) {
  formData.append('keyCode', keyCode.trim());
}
```

**API Endpoints:** All send POST to `/api/leak-check/audio|image|video`

#### 6. **CreditConfirmationModal Integration**

**Updated Props:**
```javascript
<CreditConfirmationModal
  fileName={`${originalFile?.name || ''} vs ${leakedFile?.name || ''}`}
  fileDetails={{
    type: 'audio-leak-check' | 'image-leak-check' | 'video-leak-check',
    originalFile: originalFile?.name,
    leakedFile: leakedFile?.name,
    originalSize: originalFile?.size,
    leakedSize: leakedFile?.size,
    size: (originalFile?.size || 0) + (leakedFile?.size || 0)
  }}
  actionType="audio|image|video-leak-check"
/>
```

## Component-Specific Changes

### AudioLeakChecker.jsx
**Removed (~100 lines):**
- Web Audio API waveform drawing
- AudioContext initialization
- Canvas rendering logic
- Buffer analysis functions

**Simplified:**
- Direct HTML5 `<audio>` player for previews
- Removed complex state management for audio buffers
- Cleaner file size display in KB

### PhotoLeakChecker.jsx
**Removed:**
- Audio-related state variables (leftover from copy-paste)
- Complex key decoding UI with "Decode Key" button
- Step-by-step numbered instructions

**Added:**
- Image preview thumbnails with border styling
- Responsive Grid layout for mobile/desktop
- Optional key section with file OR code input

### VideoLeakChecker.jsx
**Removed:**
- Duplicate `handleKeyFileSelect` function
- Complex key decoding UI
- Single video preview section
- Step-based workflow

**Added:**
- Dual video player previews
- Consistent Grid layout matching other checkers
- Simplified key input (no manual decode step)
- Video refs: `originalVideoRef`, `leakedVideoRef`

## Key File Handling

All three components now use consistent key file handling:

### XOR Encryption/Decryption
```javascript
// Simple XOR cipher for key file obfuscation
const xorEncrypt = (text, key) => {
  return text.split('').map((char, i) => 
    String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
};

const decryptKeyData = (encryptedText) => {
  const decrypted = xorEncrypt(encryptedText, SECRET_KEY);
  return JSON.parse(decrypted);
};
```

### Key Input Options
1. **Upload .key/.json/.txt file** - Auto-decrypts and loads
2. **Paste base64 key code** - Manual text input
3. **Optional** - Detection works without key (basic steganographic extraction)

## Button Logic Updates

**Check for Leak Button Disabled When:**
- Missing original file OR leaked file
- Already checking (`isChecking === true`)

**Button Styling:**
```javascript
disabled={!originalFile || !leakedFile || isChecking}
sx={{ 
  backgroundColor: (!originalFile || !leakedFile || isChecking) ? '#666' : '#22d3ee',
  color: (!originalFile || !leakedFile || isChecking) ? '#999' : '#001018'
}}
```

## Preview Section Updates

### Audio Previews
```jsx
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    <Typography sx={{ color: '#4caf50' }}>Original Audio</Typography>
    <audio controls src={originalPreviewUrl} style={{ width: '100%' }} />
  </Grid>
  <Grid item xs={12} md={6}>
    <Typography sx={{ color: '#ff9800' }}>Leaked Audio</Typography>
    <audio controls src={leakedPreviewUrl} style={{ width: '100%' }} />
  </Grid>
</Grid>
```

### Photo Previews
```jsx
<Box sx={{ border: '2px solid #4caf50', borderRadius: 2 }}>
  <img src={originalPreviewUrl} style={{ width: '100%', borderRadius: 8 }} />
</Box>
<Box sx={{ border: '2px solid #ff9800', borderRadius: 2 }}>
  <img src={leakedPreviewUrl} style={{ width: '100%', borderRadius: 8 }} />
</Box>
```

### Video Previews
```jsx
<video ref={originalVideoRef} controls style={{ width: '100%', maxHeight: '300px' }}>
  <source src={originalPreviewUrl} type={originalVideoFile?.type} />
</video>
<video ref={leakedVideoRef} controls style={{ width: '100%', maxHeight: '300px' }}>
  <source src={leakedPreviewUrl} type={leakedVideoFile?.type} />
</video>
```

## Backend Requirements

### API Endpoint Updates Needed

**Old Format:**
```javascript
POST /api/leak-check/audio
Body: { file: File }
```

**New Format:**
```javascript
POST /api/leak-check/audio
Body: { 
  originalAudio: File,
  leakedAudio: File,
  keyData?: string,
  keyCode?: string
}
```

Same pattern for:
- `/api/leak-check/image` (originalImage, leakedImage)
- `/api/leak-check/video` (originalVideo, leakedVideo)

### server.cjs Updates Required

Update Busboy file handlers to accept dual files:

```javascript
// Example for audio endpoint
server.post('/api/leak-check/audio', (req, res) => {
  const busboy = Busboy({ headers: req.headers });
  let originalAudio, leakedAudio, keyData, keyCode;

  busboy.on('file', (fieldname, file, info) => {
    if (fieldname === 'originalAudio') {
      originalAudio = { file, info };
    } else if (fieldname === 'leakedAudio') {
      leakedAudio = { file, info };
    }
  });

  busboy.on('field', (fieldname, value) => {
    if (fieldname === 'keyData') keyData = value;
    if (fieldname === 'keyCode') keyCode = value;
  });

  busboy.on('finish', async () => {
    // Compare originalAudio with leakedAudio
    // Extract steganographic codes
    // Check database for matches
  });
});
```

## Benefits of Simplification

### 1. **Code Maintainability**
- Removed ~150 lines of complex waveform drawing code across components
- Consistent patterns make debugging easier
- Reduced state complexity

### 2. **User Experience**
- Clear separation of original vs leaked content
- Side-by-side comparison capability
- Color-coded sections (green = original, orange = leaked)
- Simplified workflow (no manual decode steps)

### 3. **Backend Integration**
- Both files sent in single request for efficient comparison
- Server can perform differential analysis
- Better context for leak detection algorithms

### 4. **Performance**
- No heavy Canvas/AudioContext operations
- Native browser media players for previews
- Faster file handling with FormData

### 5. **Mobile Responsiveness**
- Grid system adapts to mobile (stacks vertically)
- Touch-friendly file upload buttons
- Responsive media previews

## Testing Checklist

### Frontend Testing
- [ ] Upload original file (green section works)
- [ ] Upload leaked file (orange section works)
- [ ] Button enables only when both files selected
- [ ] Preview displays correctly for both files
- [ ] Key file upload works (optional)
- [ ] Key code paste works (optional)
- [ ] Reset button clears all states
- [ ] Credit modal shows correct file names
- [ ] Mobile responsive layout works

### Backend Testing
- [ ] Endpoint receives originalAudio/Image/Video parameter
- [ ] Endpoint receives leakedAudio/Image/Video parameter
- [ ] Optional keyData field is parsed correctly
- [ ] Optional keyCode field is parsed correctly
- [ ] Comparison algorithm runs on both files
- [ ] Steganographic code extraction works
- [ ] Database lookup returns correct results
- [ ] Credits are deducted properly

### Integration Testing
- [ ] Success response shows leak detection results
- [ ] Error handling for missing files
- [ ] Error handling for corrupted files
- [ ] Error handling for invalid keys
- [ ] Loading states display correctly
- [ ] Toast notifications appear

## Future Enhancements

### Potential Improvements
1. **Diff Visualization** - Show visual differences between original and leaked
2. **Batch Processing** - Upload multiple leaked files vs one original
3. **Advanced Metrics** - Similarity scores, hash comparisons
4. **Download Report** - Generate PDF report of leak detection results
5. **Watermark Overlay** - Visual overlay showing where steganographic codes are embedded

### AI-Powered Features
1. **Smart Leak Detection** - ML model to detect subtle manipulations
2. **Fingerprint Matching** - Link leaked content to device fingerprints
3. **Pattern Recognition** - Identify common leak pathways

## Version History

**v2.0.0** (Current)
- ✅ All three leak checkers simplified
- ✅ Dual-file upload pattern implemented
- ✅ Waveform drawing removed from AudioLeakChecker
- ✅ Consistent UI/UX across all components
- ✅ CreditConfirmationModal props updated

**v1.0.0** (Legacy)
- Single file upload
- Complex waveform visualization
- Manual key decoding steps
- Inconsistent state management

## Related Documentation

- `FINGERPRINT_ARCHITECTURE.md` - Device fingerprinting system
- `LEAK_DETECTION_SYSTEM_GUIDE.md` - Backend leak detection logic
- `AUDIO_SCRAMBLER_README.md` - Audio scrambling algorithms
- `TTS_WATERMARK_SERVICE.md` - Audio watermarking system
- `CREDIT_CONFIRMATION_IMPLEMENTATION.md` - Credit modal usage

## File Locations

- `/src/pages/AudioLeakChecker.jsx` - Audio leak detection
- `/src/pages/PhotoLeakChecker.jsx` - Photo leak detection
- `/src/pages/VideoLeakChecker.jsx` - Video leak detection
- `/src/components/CreditConfirmationModal.jsx` - Credit confirmation UI
- `/server.cjs` - Backend API endpoints (requires updates)

## Contact

For questions about this refactoring, refer to:
- GitHub Issues
- Project documentation in `/docs/`
- Code comments in leak checker components
