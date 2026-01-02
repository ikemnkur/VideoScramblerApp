# Noise Removal Implementation for PhotoUnscramblerPro

## Overview
Updated PhotoUnscramblerPro.jsx to handle noise removal from unscrambled images. The noise was applied BEFORE scrambling in the Pro version, so it must be removed AFTER unscrambling.

## Files Created/Updated

### 1. `unscramble-photo-endpoint-updated.txt`
Updated Node.js endpoint that:
- Detects nested parameter format (scramble/noise/metadata)
- Maintains backward compatibility with flat format
- Extracts and passes noise parameters to Flask
- Returns noise parameters in response for client-side removal

### 2. `PhotoUnscramblerPro.jsx`
Added noise removal functionality with:

#### New Utility Functions:
- `gcd(a, b)` - Calculate greatest common divisor for tile size
- `mod(n, m)` - True mathematical modulo for negative numbers
- `mulberry32(seed)` - Seeded PRNG for deterministic noise generation
- `clampInt(n, lo, hi)` - Clamp and validate integer values
- `generateNoiseTileOffsets(tileSize, seed, intensity)` - Generate noise pattern
- `applyNoiseSubMod256(imageData, tileOffsets, tileSize)` - Remove noise (subtract mod 256)

#### Updated Functions:
1. **`loadUnscrambledImage(filename, noiseParams)`**
   - Now accepts noise parameters
   - Loads image from Flask backend
   - Calls `removeNoiseFromImage()` if noise parameters exist

2. **`removeNoiseFromImage(img, noiseParams)`**
   - Validates noise parameters
   - Creates canvas to process image
   - Calculates tile size using GCD
   - Regenerates identical noise pattern used during scrambling
   - Applies reverse noise (subtract mod 256)
   - Displays denoised image

3. **`unscrambleImage()`**
   - Extracts noise parameters from decoded key
   - Handles both nested (`key.scramble`, `key.noise`) and flat formats
   - Passes noise parameters to `loadUnscrambledImage()`
   - Supports noise from backend response or decoded key

## How It Works

### Flow Diagram:
```
1. User uploads scrambled image
2. User provides unscramble key (contains noise params)
3. Frontend sends image + params to Node backend
4. Node backend sends to Flask for unscrambling
5. Flask returns unscrambled image (still has noise)
6. Frontend receives image
7. Frontend extracts noise parameters from key
8. Frontend removes noise using same seed/intensity
9. User sees clean unscrambled image
```

### Key Format (Nested):
```javascript
{
  "scramble": {
    "algorithm": "position",
    "seed": 123456,
    "rows": 6,
    "cols": 6,
    "percentage": 100
  },
  "noise": {
    "seed": 2004541210,
    "intensity": 30,
    "mode": "add_mod256_tile",
    "prng": "mulberry32"
  },
  "metadata": {
    "username": "user123",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

## Usage Instructions

### For Backend (server.cjs):
1. Open `server.cjs`
2. Find the `/api/unscramble-photo` endpoint (around line 2833-2950)
3. Replace with code from `unscramble-photo-endpoint-updated.txt`
4. Save and restart server

### For Frontend:
The PhotoUnscramblerPro.jsx has been automatically updated with noise removal.

### Testing:
1. Scramble an image using PhotoScramblerPro with noise intensity > 0
2. Save the unscramble key
3. Use PhotoUnscramblerPro to unscramble
4. Verify the image is clean (noise removed)

## Important Notes

1. **Noise is removed CLIENT-SIDE** - The Flask backend doesn't know about noise, so the frontend must handle it

2. **Backward Compatibility** - Old keys without noise parameters will still work (noise removal is skipped)

3. **Same Seed = Same Noise** - The noise pattern is deterministic based on the seed, so using the same seed will always generate the same noise pattern

4. **Tile-based Noise** - Noise is applied in a tileable pattern (tile size = GCD of width/height), making it seamless and reversible

5. **Intensity Range** - Noise intensity is 0-127 (max offset per RGB channel)

## Error Handling

- If noise parameters are missing or invalid, the image is displayed as-is
- If noise intensity is 0, noise removal is skipped
- If tile size calculation fails, gracefully falls back to original image
- All errors are logged to console and shown to user via toast notifications

## Performance Considerations

- Noise removal uses canvas operations (fast)
- Processes entire image at once (no chunking needed for photos)
- Canvas.toBlob() is async to avoid blocking UI
- Image data is processed with `willReadFrequently: true` flag for performance

## Dependencies

All utility functions are self-contained (no external libraries needed):
- Built-in canvas API
- Standard JavaScript Math functions
- TypedArrays (Int16Array, Uint8ClampedArray)
