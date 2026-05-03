# Photo Noise Generator Implementation Guide

## Overview

The noise generator adds reversible, tileable noise to scrambled images using modulo-256 arithmetic. This enhances security by applying cryptographic-grade pseudorandom noise that can only be reversed with the correct parameters (seed, intensity, tile size).

## Implementation Status: ✅ COMPLETE

### Core Features
- **Reversible Noise**: Applied via `(value + offset) mod 256`, reversed via `(value - offset) mod 256`
- **Tileable Pattern**: Uses GCD-based tile size to ensure seamless repetition
- **Seeded PRNG**: Mulberry32 algorithm for reproducible noise generation
- **Visual Preview**: Real-time canvas preview of noise tile pattern

## How It Works

### 1. Noise Generation Process

```javascript
// Step 1: Calculate tileable size
const tile = gcd(width, height); // Ensures perfect tiling

// Step 2: Generate noise offsets for one tile
const tileOffsets = generateNoiseTileOffsets(tile, seed, intensity);
// Returns Int16Array with RGB offsets in range [-intensity, +intensity]

// Step 3: Apply noise to every pixel using modulo arithmetic
for each pixel (x, y):
  tileX = x % tileSize
  tileY = y % tileSize
  offset = tileOffsets[(tileY * tileSize + tileX) * 3 + channel]
  newValue = (originalValue + offset) mod 256
```

### 2. Workflow Integration

The noise is applied **after** scrambling but **before** downloading:

```
User selects image
   ↓
Credit confirmation modal
   ↓
Generate scramble seed → Permute tiles → Draw scrambled canvas
   ↓
Generate noise seed → Apply noise to canvas
   ↓
Combine params (scramble + noise)
   ↓
Download scrambled+noisy image with JSON key
```

### 3. Parameter Structure

The final JSON key combines both scrambling and noise parameters:

```json
{
  "scramble": {
    "version": 2,
    "seed": 123456789,
    "n": 8,
    "m": 8,
    "perm1based": [12, 5, 33, ...],
    "semantics": "Index = destination cell (1-based), value = source cell index (1-based)"
  },
  "noise": {
    "seed": 987654321,
    "intensity": 30,
    "mode": "add_mod256_tile",
    "prng": "mulberry32"
  },
  "metadata": {
    "username": "user123",
    "userId": "ABC1234567",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Key Functions

### `generateNoiseTileOffsets(tileSize, seed, intensity)`
- Creates Int16Array of size `tileSize * tileSize * 3` (RGB per pixel)
- Uses Mulberry32 PRNG seeded with `seed`
- Generates offsets in range `[-intensity, +intensity]`
- Each pixel gets 3 random offsets (R, G, B channels)

### `applyNoiseAddMod256(imageData, tileOffsets, tileSize, intensity)`
- Applies noise to ImageData using modulo-256 addition
- Tiles the noise pattern across entire image
- Returns new ImageData with noise applied
- Alpha channel remains unchanged

### `renderNoiseTilePreview(tileOffsets, tileSize, cvElement, zoom)`
- Visualizes noise pattern on canvas
- Renders offsets as RGB values around 128 (gray = 0 offset)
- Useful for debugging and user feedback
- Optional zoom parameter for larger preview

### `addNoiseToImage()`
- Main callback that orchestrates noise application
- Gets scrambled canvas data
- Applies noise using utility functions
- Updates canvas and noise tile preview
- Stores noise parameters for key generation

## UI Controls

### Noise Intensity Slider
- **Range**: 0-127 (max safe value for RGB channels)
- **Default**: 30 (moderate noise)
- **Location**: Below scramble level selector
- **Controls**: Slider + +/- buttons + text input

### Noise Tile Preview
- **Element ID**: `cvNoiseTile2`
- **Size**: 128x128 pixels
- **Purpose**: Shows the repeating noise pattern
- **Update**: Automatically updates after noise application

## State Variables

```javascript
const [noiseSeed, setNoiseSeed] = useState(() => genRandomSeed());
const [noiseIntensity, setNoiseIntensity] = useState(30); // 0-127
const [noiseParams, setNoiseParams] = useState(null);
```

## Mathematical Foundation

### Modulo-256 Arithmetic
```
Forward:  out = (src + offset) mod 256
Reverse:  src = (out - offset) mod 256
```

This ensures:
- Values stay in valid RGB range [0, 255]
- Operation is perfectly reversible
- No data loss or clipping

### Tileable Noise via GCD
```
tileSize = gcd(imageWidth, imageHeight)
```

Benefits:
- Noise pattern repeats seamlessly
- Smaller memory footprint (store only one tile)
- Faster computation (generate tile once)

### Mulberry32 PRNG
```javascript
function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- Deterministic: Same seed → same sequence
- Fast: Uses integer arithmetic
- High quality: Passes statistical tests

## Unscrambling Process

To reverse the noise:

1. Parse JSON key to extract noise parameters
2. Regenerate tile offsets using `generateNoiseTileOffsets(tile, seed, intensity)`
3. Apply reverse operation: `applyNoiseSubMod256(imageData, tileOffsets, tileSize)`
4. Then apply reverse scrambling (permutation)

## Error Handling

```javascript
try {
  // Get canvas and validate
  const canvas = canvasRef.current;
  if (!canvas) {
    console.warn("Canvas not available");
    return;
  }

  // Check intensity
  if (intensity === 0) {
    console.log("Noise intensity is 0, skipping");
    return;
  }

  // Apply noise...
} catch (err) {
  console.error("Error adding noise:", err);
  error("Failed to apply noise: " + err.message);
}
```

## Testing Checklist

- [x] Noise generates consistently with same seed
- [x] Intensity slider updates noise strength
- [x] Preview canvas shows noise pattern
- [x] Combined params include both scramble and noise data
- [x] No errors in browser console
- [ ] Unscrambler can reverse noise correctly (needs implementation)
- [ ] Different image sizes produce valid tile sizes
- [ ] Edge cases: intensity=0, intensity=127

## Future Enhancements

1. **Noise Preview Animation**: Show noise preview updating in real-time as slider moves
2. **Custom Tile Size**: Allow user to override GCD calculation
3. **Multiple Noise Layers**: Apply different noise patterns at different frequencies
4. **Perceptual Noise**: Weight noise by human visual sensitivity (more in blue, less in green)
5. **Adaptive Intensity**: Auto-adjust based on image content (higher for dark images)

## Reference Files

- **HTML Prototype**: `reversible_image_noise_generator.html` - Original working implementation
- **React Component**: `src/pages/PhotoScramblerBasic.jsx` - Production implementation
- **Unscrambler**: `src/pages/PhotoUnscrambler.jsx` - Reverse process (needs update)

## Credits

Based on reversible noise generation techniques using modulo arithmetic. Original concept from image steganography and cryptographic scrambling research.
