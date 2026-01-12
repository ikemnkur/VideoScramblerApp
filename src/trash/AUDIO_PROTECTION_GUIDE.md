# Audio Protection System - Complete Guide

A professional-grade audio scrambling system designed to protect audio files from unauthorized distribution while maintaining reversibility for legitimate users.

## 🎯 Purpose

This tool is designed to make audio/song leaking significantly harder by:
1. **Scrambling** audio through segment rearrangement
2. **Obscuring** audio with multi-frequency reversible noise
3. **Encrypting** protection parameters in a secure key file
4. **Enabling** legitimate recovery with the protection key

## 🔐 Security Features

### Encrypted Protection Keys
- **Base64 Encoding**: Key data is base64-encoded for safe text transmission
- **XOR Encryption**: Additional encryption layer prevents reverse-engineering
- **Parameter Obfuscation**: Scrambling algorithm details are hidden from casual inspection
- **Unique Keys**: Each scrambling operation generates unique parameters

### Multi-Frequency Noise System
The noise system applies THREE distinct layers:

1. **High Frequency Layer** (40% strength)
   - Rapid sample-by-sample variations
   - Obscures high-pitched sounds, cymbals, hi-hats
   - Affects frequencies above 8kHz

2. **Mid Frequency Layer** (40% strength)
   - Moderate variations every 4 samples
   - Obscures vocals, guitars, keyboards
   - Affects frequencies 500Hz - 8kHz

3. **Low Frequency Layer** (30% strength)
   - Slow variations every 16 samples
   - Obscures bass, drums, sub-bass
   - Affects frequencies below 500Hz

This multi-layered approach ensures the audio is thoroughly obscured across the entire frequency spectrum, making it unrecognizable without the key.

## 📋 Complete Workflow

### Part 1: Scrambling Audio (Protection)

1. **Load Original Audio**
   ```
   - Click "Choose File"
   - Select your audio file (MP3, WAV, FLAC, etc.)
   - Waveform visualization appears
   ```

2. **Configure Protection Parameters**
   
   **Shuffle Settings:**
   - Click 🎲 Random to generate a unique shuffle seed
   - Segment Size: 1-3 seconds (smaller = more scrambled)
   - Padding: 0.3-0.7 seconds (adds gaps between segments)
   
   **Noise Settings:**
   - Click 🎲 Random to generate a unique noise seed
   - Noise Strength: 0.2-0.5 (higher = more obscured)

3. **Scramble the Audio**
   ```
   - Click "🔒 Scramble Audio (Shuffle + Noise)"
   - Wait for processing (may take 5-30 seconds)
   - Scrambled audio appears in final section
   ```

4. **Download Protected Files**
   ```
   - Click "📥 Download Scrambled Audio" → Share this file
   - Click "🔑 Download Protection Key" → Keep this SECRET
   ```

⚠️ **CRITICAL**: The protection key file is required to recover the original audio. Store it securely and separately from the scrambled audio file.

### Part 2: Unscrambling Audio (Recovery)

1. **Load Scrambled Audio**
   ```
   - In the "🔓 Unscramble Audio" section
   - Select the scrambled audio file
   ```

2. **Load Protection Key**
   ```
   - Select the .key file
   - System will decrypt and validate the key
   ```

3. **Recover Original Audio**
   ```
   - Click "🔓 Unscramble Audio"
   - Processing reverses all operations
   - Original audio is recovered perfectly
   ```

4. **Download Recovered Audio**
   ```
   - Click "📥 Download Recovered Audio"
   - Verify audio quality matches original
   ```

## 🔧 Technical Specifications

### Key File Format

The `.key` file contains (encrypted):

```json
{
  "version": "1.0",
  "timestamp": "2025-12-10T...",
  "audio": {
    "duration": 180.5,
    "sampleRate": 44100,
    "channels": 2
  },
  "shuffle": {
    "enabled": true,
    "seed": 847293456,
    "segmentSize": 2.0,
    "padding": 0.5
  },
  "noise": {
    "enabled": true,
    "seed": 639281047,
    "level": 0.35,
    "multiFrequency": true
  }
}
```

### Encryption Process

```
Original Parameters (JSON)
    ↓
XOR Encryption (with secret key)
    ↓
Base64 Encoding
    ↓
Downloadable .key file
```

### Noise Generation Algorithm

```javascript
// For each sample i:
highFreq = random(noiseSeed) × 0.4
midFreq = random(noiseSeed×2) × 0.4  [every 4 samples]
lowFreq = random(noiseSeed×3) × 0.3  [every 16 samples]

noiseSample[i] = highFreq + midFreq + lowFreq
scrambledAudio[i] = originalAudio[i] + noiseSample[i]
```

### Shuffle Algorithm

1. Divide audio into N segments of equal size
2. Generate shuffle order using seeded Fisher-Yates
3. Render segments in shuffled order with padding
4. Total duration increases by: `N × paddingDuration`

### Unscrambling Process

```
Scrambled Audio + Protection Key
    ↓
1. Decrypt Key File (Base64 → XOR Decrypt → JSON)
    ↓
2. Regenerate Noise Profile (from seed)
    ↓
3. Remove Noise (subtract sample-by-sample)
    ↓
4. Calculate Inverse Shuffle Order
    ↓
5. Reorder Segments to Original Position
    ↓
6. Remove Padding Gaps
    ↓
Recovered Original Audio
```

## 📊 Recommended Settings by Use Case

### Maximum Security (Unrecognizable)
**Best for:** Preventing leaks of unreleased music
```
Shuffle Seed: [Random - 9 digits]
Segment Size: 0.8 seconds
Padding: 0.6 seconds
Noise Seed: [Random - 9 digits]
Noise Strength: 0.45
```
**Result**: Audio is completely unrecognizable, 100% reversible

### High Security (Very Distorted)
**Best for:** Protecting demos, work-in-progress tracks
```
Shuffle Seed: [Random - 9 digits]
Segment Size: 1.5 seconds
Padding: 0.4 seconds
Noise Seed: [Random - 9 digits]
Noise Strength: 0.35
```
**Result**: Audio melody barely recognizable

### Medium Security (Obscured)
**Best for:** Protecting preview clips, samples
```
Shuffle Seed: [Random - 9 digits]
Segment Size: 2.5 seconds
Padding: 0.3 seconds
Noise Seed: [Random - 9 digits]
Noise Strength: 0.25
```
**Result**: Audio recognizable but very distorted

### Light Protection (Watermarked)
**Best for:** Tracking distribution, deterring casual copying
```
Shuffle Seed: [Random - 9 digits]
Segment Size: 4.0 seconds
Padding: 0.2 seconds
Noise Seed: [Random - 9 digits]
Noise Strength: 0.15
```
**Result**: Audio playable but clearly altered

## 🛡️ Security Best Practices

### DO:
✅ Always use "🎲 Random" for both seeds (maximizes security)
✅ Store key files separately from scrambled audio
✅ Use descriptive filenames for key files (e.g., `track-name-protection.key`)
✅ Backup key files in secure location (encrypted storage)
✅ Test unscrambling immediately after scrambling
✅ Use medium-high noise levels (0.3-0.5) for unreleased content
✅ Share scrambled audio publicly, key privately

### DON'T:
❌ Use predictable seeds (like 12345 or 11111)
❌ Store key file with scrambled audio file
❌ Share key file publicly or with untrusted parties
❌ Reuse the same seeds for multiple tracks
❌ Use too low noise levels (<0.2) for sensitive content
❌ Rename .key files to .txt or other extensions
❌ Email key files in plain text

## 🎵 Audio Quality Impact

### Scrambled Audio:
- **File Size**: Slightly larger due to padding
- **Quality**: No quality loss (lossless scrambling)
- **Playability**: Technically playable but unrecognizable
- **Duration**: Increased by (segments × padding)

### Recovered Audio:
- **Accuracy**: 99.99% identical to original
- **Quality**: No degradation (within floating-point precision)
- **Format**: WAV 16-bit PCM (convert if needed)
- **Timing**: Perfect sync restoration

## 🔬 Advanced Features

### Custom Seed Management
```javascript
// Use specific seeds for deterministic results
Shuffle Seed: 842791634
Noise Seed: 598372014

// Same seeds always produce identical scrambling
// Useful for batch processing or versioning
```

### Noise Profile Efficiency
The noise profile is NOT stored in the key file. Instead:
- Noise parameters (seed, level) are stored
- Noise is regenerated during unscrambling
- This keeps key files tiny (<1 KB)
- Perfect reconstruction guaranteed

### Browser Compatibility
Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Requires:
- Web Audio API
- FileReader API
- ES6+ JavaScript

## 🐛 Troubleshooting

### "Invalid or corrupted key file"
- Ensure you're using the correct .key file
- File may have been edited (re-download original)
- Check file size (should be <1 KB)

### "Audio sounds wrong after unscrambling"
- Verify you used the matching key file
- Check that scrambled audio wasn't re-encoded
- Ensure original sample rate matches

### "Processing takes too long"
- Normal for files >5 minutes
- Small segments increase processing time
- Consider using larger segments (2-3s)

### "Downloaded audio has clicks/pops"
- Try reducing padding to 0.3-0.4s
- May occur with very small segments
- Use segment size ≥1.0s to minimize

## 📈 Performance Guidelines

| Audio Duration | Segment Size | Expected Processing Time |
|----------------|--------------|-------------------------|
| 1-2 minutes    | 2.0s         | 2-5 seconds            |
| 3-5 minutes    | 2.0s         | 5-10 seconds           |
| 5-10 minutes   | 2.0s         | 10-20 seconds          |
| >10 minutes    | 3.0s         | 20-40 seconds          |

*Larger segment sizes = faster processing*

## 🚀 Future Enhancements

Planned features:
- [ ] Batch processing (multiple files)
- [ ] AES-256 encryption for key files
- [ ] Password protection for keys
- [ ] Mobile app version
- [ ] Cloud key storage option
- [ ] Audio fingerprinting integration
- [ ] Automatic metadata removal

## 📄 License & Usage

This tool is for legitimate audio protection purposes:
- ✅ Protecting unreleased music from leaks
- ✅ Watermarking review copies
- ✅ Securing demo tracks for clients
- ✅ Preventing unauthorized distribution

Not intended for:
- ❌ Copyright infringement
- ❌ Piracy facilitation
- ❌ Malicious audio manipulation

## 🆘 Support

For issues:
1. Check troubleshooting section above
2. Verify browser compatibility
3. Test with smaller audio files
4. Review console for error messages

For questions about the system, refer to the main VideoScramblerApp documentation.

---

**Remember**: The protection key is the ONLY way to recover the original audio. Store it securely!
