# Device Fingerprinting System - Leak Prevention

This system creates a unique device fingerprint that can be embedded in unscrambled content to track the source of potential leaks.

## Overview

The fingerprinting system collects various browser and device information to create a unique identifier that is embedded into unscrambled images/videos. If content is leaked, you can decode the embedded fingerprint to identify which device and account was used to unscramble it.

## Components

### 1. DeviceFingerprint.js (Core Utility)
Location: `/src/utils/DeviceFingerprint.js`

The main fingerprinting engine that collects:
- **Browser Information**: Name, version, user agent, vendor
- **Device Information**: Type (mobile/tablet/desktop), platform, hardware
- **Screen Information**: Resolution, pixel depth, orientation
- **Hardware**: CPU cores, memory, GPU details
- **Network**: Connection type, approximate IP
- **Advanced Fingerprints**: Canvas, WebGL, Audio context
- **Features**: Installed fonts, plugins, browser capabilities
- **Location Hints**: Timezone, language preferences

### 2. FingerprintContext.jsx (React Provider)
Location: `/src/contexts/FingerprintContext.jsx`

Provides fingerprint data throughout your React app.

### 3. FingerprintDisplay.jsx (UI Component)
Location: `/src/components/FingerprintDisplay.jsx`

Displays fingerprint information to users and admins.

## Setup

### Step 1: Wrap Your App with FingerprintProvider

```jsx
// main.jsx or App.jsx
import { FingerprintProvider } from './contexts/FingerprintContext';

function App() {
  return (
    <FingerprintProvider>
      {/* Your app components */}
    </FingerprintProvider>
  );
}
```

### Step 2: Use the Hook in Your Components

```jsx
import { useFingerprint } from '../contexts/FingerprintContext';

function MyComponent() {
  const { 
    fingerprint,           // Full fingerprint object
    compactFingerprint,    // Compact version for embedding
    getEmbeddableFingerprint, // Get base64 encoded fingerprint
    decodeFingerprint,     // Decode embedded fingerprint
    loading,
    error 
  } = useFingerprint();

  if (loading) return <div>Loading fingerprint...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Device Hash: {fingerprint.shortHash}</p>
      <p>Browser: {fingerprint.browser.name}</p>
    </div>
  );
}
```

## Integration with Unscrambler (Pro Version)

### Example: Embedding Fingerprint in Unscrambled Images

```jsx
// UnscramblerPhotosPro.jsx
import { useFingerprint } from '../contexts/FingerprintContext';

function UnscramblerPhotosPro() {
  const { getEmbeddableFingerprint, compactFingerprint } = useFingerprint();

  const unscrambleImage = async () => {
    // Get the fingerprint to embed
    const fingerprintData = getEmbeddableFingerprint();
    
    // Get user info
    const userData = JSON.parse(localStorage.getItem('userdata') || '{}');
    
    // Prepare unscramble request
    const params = {
      input: scrambledFilename,
      output: `unscrambled_${Date.now()}.jpg`,
      seed: keySeed,
      mode: 'unscramble',
      algorithm: selectedAlgorithm,
      
      // Add leak prevention metadata
      metadata: {
        fingerprint: fingerprintData,
        userId: userData.id,
        username: userData.username,
        email: userData.email,
        timestamp: new Date().toISOString(),
        deviceHash: compactFingerprint.hash
      }
    };

    // Send to server for processing
    const response = await fetch('http://localhost:5000/unscramble-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    // Server embeds fingerprint as invisible watermark or EXIF data
  };

  return (
    // Your unscrambler UI
  );
}
```

## Server-Side Implementation (Python)

Update your Python scrambling scripts to embed the fingerprint:

```python
# In your unscramble_photo.py or similar
import json
import base64
from PIL import Image
from PIL.ExifTags import TAGS

def embed_fingerprint_metadata(image_path, metadata):
    """
    Embed fingerprint metadata into image EXIF data
    """
    img = Image.open(image_path)
    
    # Convert metadata to JSON and encode
    metadata_json = json.dumps(metadata)
    metadata_encoded = base64.b64encode(metadata_json.encode()).decode()
    
    # Create EXIF data
    exif = img.getexif()
    
    # Use UserComment field (tag 37510) to store fingerprint
    # This is invisible to normal viewers but can be extracted
    exif[0x9286] = metadata_encoded  # UserComment
    exif[0x010E] = f"Unscrambled by: {metadata.get('username', 'Unknown')}"  # ImageDescription
    exif[0x013B] = metadata.get('email', 'unknown@example.com')  # Artist
    
    # Save with EXIF data
    img.save(image_path, exif=exif, quality=95)
    
    return image_path

def extract_fingerprint_from_image(image_path):
    """
    Extract embedded fingerprint from image
    """
    img = Image.open(image_path)
    exif = img.getexif()
    
    if 0x9286 in exif:  # UserComment
        metadata_encoded = exif[0x9286]
        try:
            metadata_json = base64.b64decode(metadata_encoded).decode()
            metadata = json.loads(metadata_json)
            return metadata
        except:
            return None
    
    return None

# Usage in your unscramble endpoint
def unscramble_photo(params):
    # ... your unscramble logic ...
    
    # After unscrambling, embed the fingerprint
    if 'metadata' in params:
        output_path = params['output']
        embed_fingerprint_metadata(output_path, params['metadata'])
    
    return output_path
```

## Invisible Watermarking (Advanced)

For more robust leak prevention, implement invisible watermarking:

```python
import numpy as np
from PIL import Image

def embed_invisible_watermark(image_path, fingerprint_data, strength=10):
    """
    Embed fingerprint as invisible watermark using LSB steganography
    """
    img = Image.open(image_path)
    img_array = np.array(img)
    
    # Convert fingerprint to binary
    watermark_text = json.dumps(fingerprint_data)
    watermark_binary = ''.join(format(ord(c), '08b') for c in watermark_text)
    watermark_binary += '1111111111111110'  # End marker
    
    # Embed in LSB of blue channel
    flat = img_array[:,:,2].flatten()
    for i, bit in enumerate(watermark_binary):
        if i >= len(flat):
            break
        flat[i] = (flat[i] & 0xFE) | int(bit)
    
    img_array[:,:,2] = flat.reshape(img_array[:,:,2].shape)
    
    # Save watermarked image
    Image.fromarray(img_array).save(image_path)
    
def extract_invisible_watermark(image_path):
    """
    Extract invisible watermark from image
    """
    img = Image.open(image_path)
    img_array = np.array(img)
    
    # Extract LSB from blue channel
    flat = img_array[:,:,2].flatten()
    binary = ''.join(str(pixel & 1) for pixel in flat)
    
    # Find end marker and convert to text
    end_marker = '1111111111111110'
    end_pos = binary.find(end_marker)
    
    if end_pos == -1:
        return None
    
    watermark_binary = binary[:end_pos]
    
    # Convert binary to text
    chars = [watermark_binary[i:i+8] for i in range(0, len(watermark_binary), 8)]
    watermark_text = ''.join(chr(int(char, 2)) for char in chars if len(char) == 8)
    
    try:
        return json.loads(watermark_text)
    except:
        return None
```

## Displaying Fingerprint to Users

```jsx
import FingerprintDisplay from '../components/FingerprintDisplay';

function SettingsPage() {
  return (
    <div>
      <h1>Your Device Information</h1>
      <FingerprintDisplay showDetails={true} />
      
      {/* Or compact version */}
      <FingerprintDisplay compact={true} />
    </div>
  );
}
```

## Detecting Leaked Content

When you find leaked content, extract and decode the fingerprint:

```python
# Check leaked image
leaked_image_path = 'leaked_content.jpg'
fingerprint = extract_fingerprint_from_image(leaked_image_path)

if fingerprint:
    print(f"Content was unscrambled by:")
    print(f"  User: {fingerprint['username']} ({fingerprint['userId']})")
    print(f"  Email: {fingerprint['email']}")
    print(f"  Device: {fingerprint['device']} - {fingerprint['browser']}")
    print(f"  Screen: {fingerprint['screen']}")
    print(f"  Timezone: {fingerprint['timezone']}")
    print(f"  Timestamp: {fingerprint['timestamp']}")
    print(f"  Device Hash: {fingerprint['hash']}")
    print(f"  IP: {fingerprint['ip']}")
    
    # Take action: ban user, notify, log incident, etc.
```

## Fingerprint Data Structure

### Full Fingerprint
```javascript
{
  timestamp: "2025-11-07T...",
  sessionId: "1699...",
  hash: "a3f5c9...",  // Full SHA-256 hash
  shortHash: "a3f5c9...", // First 16 chars
  browser: { name, version, userAgent, vendor, ... },
  device: { type, platform, memory, cores, ... },
  screen: { width, height, colorDepth, ... },
  hardware: { cores, memory, gpu, ... },
  canvas: "data:image/png...", // Canvas fingerprint
  webgl: { version, renderer, vendor, ... },
  audio: { hash, sampleRate, ... },
  plugins: [...],
  features: { localStorage, webgl, bluetooth, ... },
  fonts: ["Arial", "Helvetica", ...],
  timezone: { timezone, offset, ... },
  language: { language, languages, ... },
  network: { connection, ipInfo, ... }
}
```

### Compact Fingerprint (for embedding)
```javascript
{
  hash: "a3f5c9...",
  timestamp: "2025-11-07T...",
  userId: "user123",
  username: "john_doe",
  email: "john@example.com",
  device: "Desktop",
  browser: "Chrome 120.0",
  os: "Windows",
  screen: "1920x1080",
  timezone: "America/New_York",
  language: "en-US",
  ip: "192.168.1.100",
  canvasHash: "8f3a...",
  webglHash: "9c2b..."
}
```

## Privacy Considerations

1. **Transparency**: Show users what data is being collected
2. **Consent**: Get user consent before collecting fingerprint data
3. **Storage**: Store only necessary data, encrypt sensitive information
4. **Disclosure**: Clearly state in ToS that unscrambled content is watermarked
5. **GDPR/Privacy Laws**: Ensure compliance with applicable privacy regulations

## Best Practices

1. **Always embed fingerprint** when unscrambling content
2. **Use both EXIF and invisible watermark** for redundancy
3. **Log all unscramble operations** with fingerprint data
4. **Periodic audits**: Check for leaked content and trace sources
5. **Update fingerprinting**: Refresh fingerprint periodically to catch changes
6. **Multi-factor tracking**: Combine fingerprint with account data and IP logs

## Testing

Test the fingerprinting system:

```jsx
import DeviceFingerprint from './utils/DeviceFingerprint';

async function testFingerprint() {
  const fp = await DeviceFingerprint.generate();
  console.log('Full Fingerprint:', fp);
  
  const compact = await DeviceFingerprint.getCompactFingerprint({
    userId: 'test123',
    username: 'testuser',
    email: 'test@example.com'
  });
  console.log('Compact:', compact);
  
  const encoded = DeviceFingerprint.encodeForEmbedding(compact);
  console.log('Encoded:', encoded);
  
  const decoded = DeviceFingerprint.decodeFromEmbedding(encoded);
  console.log('Decoded:', decoded);
}
```

## License

Same as the main VideoScramblerApp project.
