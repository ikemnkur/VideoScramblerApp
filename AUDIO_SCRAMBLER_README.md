# Audio Scrambler WebApp

A web-based audio scrambler that can perform two types of reversible audio obfuscation:
1. **Segment Shuffling** - Splits audio into segments and rearranges them
2. **Noise Application** - Applies reversible noise to audio using a seeded random generator

Both operations can be combined for enhanced scrambling.

## Features

### 🔀 Audio Shuffling (Segment Rearrangement)
- Splits audio into configurable time segments
- Rearranges segments based on a seeded random algorithm
- Adds optional padding (silence) between segments
- Fully deterministic - same seed produces same shuffle pattern

**Parameters:**
- **Shuffle Seed**: Integer that determines the shuffle pattern (e.g., 12345)
- **Segment Size**: Duration of each audio segment in seconds (e.g., 2.0s)
- **Padding**: Silence duration between segments in seconds (e.g., 0.5s)

### 🔊 Noise Scrambling (Reversible Noise)
- Generates pseudorandom noise based on a seed
- Adds noise to audio samples while maintaining playability
- Noise can be precisely removed using the same seed
- Noise strength is adjustable

**Parameters:**
- **Noise Seed**: Integer that determines the noise pattern (e.g., 54321)
- **Noise Strength**: Amplitude of noise (0.0 - 1.0, recommended: 0.1 - 0.5)

### 🎵 Combined Operations
Apply both shuffle and noise in sequence:
1. Original audio → Shuffled audio
2. Shuffled audio → Shuffled + Noisy audio

### 🔄 Reversibility
- **Noise Removal**: Click "Remove Noise" to reverse noise application using the stored seed
- **Shuffle Reversal**: Requires the inverse permutation (seed-based reconstruction possible)
- **Full Recovery**: Remove noise first, then theoretically un-shuffle with seed

## Usage

### Basic Workflow

1. **Load Audio File**
   - Click "Choose File" and select an audio file (MP3, WAV, etc.)
   - Waveform visualization will appear
   - Audio duration will be displayed

2. **Apply Shuffle Only**
   - Configure shuffle parameters (seed, segment size, padding)
   - Click "Apply Shuffle"
   - Preview shuffled audio in the middle section
   - Download using the download link

3. **Apply Noise Only**
   - Configure noise parameters (seed, noise level)
   - Click "Apply Noise"
   - Preview noisy audio in the middle section
   - Click "Remove Noise" to test reversibility

4. **Apply Both Operations**
   - Configure both shuffle and noise parameters
   - Click "Apply Both (Shuffle + Noise)"
   - Final scrambled audio appears in bottom section
   - Download the processed file

### Recommended Settings

**Light Scrambling** (reversible, recognizable):
- Segment Size: 2-3 seconds
- Padding: 0.1-0.3 seconds
- Noise Level: 0.1-0.2

**Medium Scrambling** (challenging but reversible):
- Segment Size: 1-2 seconds
- Padding: 0.3-0.5 seconds
- Noise Level: 0.2-0.4

**Heavy Scrambling** (maximum obfuscation):
- Segment Size: 0.5-1 seconds
- Padding: 0.5-1.0 seconds
- Noise Level: 0.3-0.5

## Technical Details

### Seeded Random Number Generator
Uses a Linear Congruential Generator (LCG) for deterministic pseudorandom numbers:
```
value = (value × 9301 + 49297) mod 233280
```

### Noise Application Algorithm
- Generates noise array based on seed
- Adds noise sample-by-sample: `output[i] = input[i] + noise[i]`
- Clips to [-1, 1] range to prevent distortion
- Reversal: `recovered[i] = noisy[i] - noise[i]`

### Segment Shuffling Algorithm
1. Divide audio into N segments of equal duration
2. Create array of segment indices [0, 1, 2, ..., N-1]
3. Apply Fisher-Yates shuffle with seeded RNG
4. Render segments in shuffled order using Web Audio API OfflineAudioContext

### File Format
- Output: WAV format (PCM 16-bit)
- Multi-channel support (mono/stereo)
- Sample rate preserved from original file

## Browser Compatibility

Requires modern browser with:
- Web Audio API support
- FileReader API
- ES6+ JavaScript features

**Tested on:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Limitations

1. **Memory**: Large files (>100MB) may cause performance issues
2. **Shuffle Reversal**: Not implemented in UI (requires storing permutation mapping)
3. **Processing Time**: Complex operations on long files may take several seconds
4. **Noise Level**: Too high (>0.7) may cause significant audio distortion

## Development Notes

### Key Functions

- `seededRandom(seed)` - Creates seeded RNG function
- `seededShuffle(array, seed)` - Shuffles array deterministically
- `generateNoise(length, level, seed)` - Creates noise profile
- `applyNoise(buffer, noise)` - Adds noise to audio buffer
- `reverseNoise(buffer, noise)` - Removes noise from audio buffer
- `renderShuffledAudio(buffer, segments, padding)` - Renders shuffled audio
- `bufferToWavUrl(buffer)` - Converts AudioBuffer to downloadable WAV

### Extending the App

**To add un-shuffle capability:**
1. Store the shuffle permutation along with the seed
2. Create inverse permutation mapping
3. Apply reverse shuffle in `handleReverseAll()`

**To add more scrambling methods:**
1. Implement in separate function (e.g., `applyReverb()`)
2. Add UI controls in HTML
3. Wire up event handlers
4. Integrate into combined operations flow

## License

This is a demonstration/educational tool. Use responsibly.

## Support

For issues or questions, refer to the main VideoScramblerApp documentation.
