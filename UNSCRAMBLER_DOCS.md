# Photo Unscrambler Documentation

## Overview

The **UnscramblerPhotosPro** component allows users to restore scrambled images to their original state using an unscramble key. It's the companion tool to **ScramblerPhotosPro**.

## Features

### 3 Main Actions:
1. **Decode Key** - Validates and decodes the base64-encoded unscramble key
2. **Server Unscramble** - Sends scrambled image + decoded key to backend for processing
3. **Download Unscrambled Image** - Downloads the restored original image

## User Flow

### Step 1: Upload Scrambled Image
- Click "Choose Scrambled Image"
- Select the scrambled image file
- Preview appears in left panel

### Step 2: Paste and Decode Key
- Paste the unscramble key (received when image was scrambled)
- Click "Decode Key"
- System validates key and displays parameters:
  - Algorithm used
  - Seed value
  - Grid dimensions (if applicable)
  - Scrambling percentage
  - Timestamp

### Step 3: Unscramble
- Click "Unscramble on Server"
- Backend processes image with decoded parameters
- Restored image appears in right panel
- Click "Download Unscrambled Image" to save

## Key Format

Keys are base64-encoded JSON containing:

```json
{
  "algorithm": "position|color|rotation|mirror|intensity",
  "seed": 123456789,
  "rows": 6,
  "cols": 6,
  "percentage": 100,
  "maxHueShift": 64,
  "maxIntensityShift": 128,
  "timestamp": 1699488000000
}
```

## Backend Integration

### Endpoint: POST `/api/unscramble-photo`

**Request:**
- Multipart form data
- `file`: Scrambled image file
- `params`: JSON string with unscrambling parameters

**Response:**
```json
{
  "success": true,
  "output_file": "unscrambled_image-123456.jpg",
  "unscrambledImageUrl": "http://localhost:5000/outputs/unscrambled_image-123456.jpg"
}
```

## Flask Service Integration

Your Flask service needs to handle the `/unscramble-photo` endpoint:

```python
@app.route('/unscramble-photo', methods=['POST'])
def unscramble_photo():
    data = request.get_json()
    
    local_file_path = data.get('localFilePath')
    params = data.get('params', {})
    
    # Load scrambled image
    img = Image.open(local_file_path)
    
    # Apply unscrambling (reverse of scrambling)
    algorithm = params.get('algorithm')
    seed = params.get('seed')
    random.seed(seed)  # Use same seed for consistency
    
    if algorithm == 'position':
        unscrambled_img = unscramble_position(img, params)
    # ... handle other algorithms
    
    # Save unscrambled image
    output_filename = f"unscrambled_{os.path.basename(local_file_path)}"
    output_path = os.path.join(OUTPUTS_DIR, output_filename)
    unscrambled_img.save(output_path)
    
    return jsonify({
        'success': True,
        'output_file': output_filename,
        'unscrambledImageUrl': f'http://localhost:5000/outputs/{output_filename}'
    })
```

## Unscrambling Algorithms

### Position Unscrambling
Reverses tile shuffling by using the same seed to regenerate the shuffle pattern, then applying the inverse permutation.

```python
def unscramble_position(img, params):
    rows = params.get('rows', 6)
    cols = params.get('cols', 6)
    
    # Same logic as scramble but apply inverse permutation
    # Use the seed to regenerate the exact same shuffle order
    # Then reverse it
```

### Color Unscrambling
Reverses hue shifts by subtracting the same random shifts.

### Rotation Unscrambling
Rotates tiles back to original orientation.

### Mirror Unscrambling
Flips tiles back to original direction.

### Intensity Unscrambling
Reverses intensity shifts.

## Component Props

```jsx
<UnscramblerPhotosPro />
```

No props required - fully self-contained.

## State Management

### Key States:
- `selectedFile` - Uploaded scrambled image
- `keyCode` - Raw base64 key string
- `decodedKey` - Parsed key object
- `keyValid` - Boolean indicating if key is valid
- `unscrambledFilename` - Name of restored image
- `isProcessing` - Loading state during unscrambling

## Error Handling

### Common Errors:
1. **"Invalid key format"** - Key is corrupted or not base64 encoded
2. **"Please decode your key first"** - User tried to unscramble without decoding key
3. **"Failed to load unscrambled image"** - Flask service error or network issue
4. **"Python/Flask service is not running"** - Backend can't reach Flask on port 5000

## UI/UX Features

### Visual Feedback:
- ✅ Success chips when key is decoded
- ⚠️ Warning alerts when steps are incomplete
- 🔄 Loading spinner during processing
- Color-coded buttons showing enabled/disabled states

### Information Display:
- Decoded key parameters shown in success alert
- Step numbers (1, 2, 3) guide user through process
- Side-by-side comparison of scrambled vs unscrambled images

## Security Considerations

### Key Security:
- Keys should be transmitted securely (HTTPS in production)
- Keys contain algorithm details but not the actual image data
- Without the key, unscrambling is computationally infeasible

### Best Practices:
1. Store keys separately from scrambled images
2. Use secure channels to share keys
3. Consider adding key expiration dates
4. Implement rate limiting on unscramble endpoint
5. Add user authentication for paid features

## Integration with Router

Add to your routing configuration:

```jsx
import UnscramblerPhotosPro from './pages/UnscramblerPhotosPro';

<Route path="/unscrambler" element={<UnscramblerPhotosPro />} />
```

## Testing Checklist

- [ ] Upload scrambled image - preview shows correctly
- [ ] Paste valid key - decodes successfully
- [ ] Paste invalid key - shows error message
- [ ] Click unscramble without key - shows warning
- [ ] Unscramble with valid key - restores original image
- [ ] Download unscrambled image - file downloads correctly
- [ ] Test all algorithms (position, color, rotation, mirror, intensity)
- [ ] Test with different image formats (PNG, JPG)
- [ ] Test with large images (>5MB)
- [ ] Verify backend error handling

## Example Usage Scenario

1. **Creator side (Scrambler):**
   - Upload `vacation_photo.jpg`
   - Scramble with Position algorithm
   - Download `scrambled_vacation_photo.jpg`
   - Save key: `eyJhbGdvcml0aG0iOi...`

2. **Recipient side (Unscrambler):**
   - Receive `scrambled_vacation_photo.jpg` via email
   - Receive key separately via secure channel
   - Open Unscrambler page
   - Upload scrambled image
   - Paste key and decode
   - Click unscramble
   - Download restored `vacation_photo.jpg`

## Performance Notes

- Image processing time depends on:
  - Image size (larger = slower)
  - Algorithm complexity
  - Number of tiles (more tiles = more processing)
  - Server resources

- Typical processing times:
  - Small image (< 1MB): 1-3 seconds
  - Medium image (1-5MB): 3-8 seconds
  - Large image (5-10MB): 8-15 seconds

## Future Enhancements

- [ ] Batch unscrambling (multiple images at once)
- [ ] Key history/storage in user account
- [ ] Preview thumbnail before full unscramble
- [ ] Progress bar showing unscrambling percentage
- [ ] Partial unscramble option (unscramble % of image)
- [ ] QR code key format for easier sharing
- [ ] Encrypted key storage option
- [ ] Key verification checksum

## Troubleshooting

### Issue: "Key not working"
- Ensure you copied the complete key (no truncation)
- Check for extra spaces or newlines
- Verify key matches the scrambled image

### Issue: "Unscrambled image looks wrong"
- Verify you're using the correct key for this specific image
- Check that seed matches
- Ensure algorithm matches

### Issue: "Server timeout"
- Image may be too large
- Flask service may be overloaded
- Check network connection

## API Rate Limits (Recommended)

For production:
- 10 unscramble requests per minute per user
- 100 unscramble requests per day for free tier
- Unlimited for premium subscribers

## Credits System Integration

Optionally integrate with credits:
- Charge 1 credit per unscramble operation
- Free for images you scrambled yourself
- Premium users get discounted rates

## Monitoring & Analytics

Track:
- Number of successful unscrambles
- Average processing time
- Common algorithms used
- Error rates by algorithm
- User retention (scramble → unscramble conversion)
