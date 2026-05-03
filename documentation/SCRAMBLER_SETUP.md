# Photo Scrambler Setup Guide

## Backend Setup

### 1. Install Required Dependencies

```bash
npm install multer axios
```

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# Flask/Python Service URL
FLASKAPP_LINK=http://localhost:5000
```

### 3. Create Required Directories

The server will automatically create these directories, but you can create them manually:

```bash
mkdir -p python/inputs
mkdir -p python/outputs
```

### 4. Start the Backend Server

```bash
node old-server.cjs
```

You should see:
```
🚀 Express Server with MySQL is running on port 3001
🐍 Flask Service: http://localhost:5000
```

## Flask/Python Service Setup

You need to create a Flask service that handles the actual image scrambling.

### 1. Create Flask Server (`python/scrambler_service.py`)

```python
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
from PIL import Image
import random

app = Flask(__name__)
CORS(app)

INPUTS_DIR = 'inputs'
OUTPUTS_DIR = 'outputs'

# Create directories if they don't exist
os.makedirs(INPUTS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)

@app.route('/scramble-photo', methods=['POST'])
def scramble_photo():
    try:
        data = request.get_json()
        
        local_file_name = data.get('localFileName')
        local_file_path = data.get('localFilePath')
        params = data.get('params', {})
        
        print(f"Scrambling image: {local_file_name}")
        print(f"Parameters: {params}")
        
        # Load the image
        img = Image.open(local_file_path)
        
        # Get algorithm
        algorithm = params.get('algorithm', 'position')
        seed = params.get('seed', 42)
        random.seed(seed)
        
        # Apply scrambling based on algorithm
        if algorithm == 'position':
            scrambled_img = scramble_position(img, params)
        elif algorithm == 'color':
            scrambled_img = scramble_color(img, params)
        elif algorithm == 'rotation':
            scrambled_img = scramble_rotation(img, params)
        elif algorithm == 'mirror':
            scrambled_img = scramble_mirror(img, params)
        elif algorithm == 'intensity':
            scrambled_img = scramble_intensity(img, params)
        else:
            scrambled_img = img
        
        # Save scrambled image
        output_filename = f"scrambled_{local_file_name}"
        output_path = os.path.join(OUTPUTS_DIR, output_filename)
        scrambled_img.save(output_path)
        
        print(f"✅ Scrambled image saved: {output_filename}")
        
        return jsonify({
            'success': True,
            'output_file': output_filename,
            'scrambledFileName': output_filename,
            'scrambledImageUrl': f'http://localhost:5000/outputs/{output_filename}'
        })
        
    except Exception as e:
        print(f"❌ Error scrambling image: {str(e)}")
        return jsonify({'error': str(e)}), 500


def scramble_position(img, params):
    """Scramble by shuffling tile positions"""
    rows = params.get('rows', 6)
    cols = params.get('cols', 6)
    percentage = params.get('percentage', 100) / 100.0
    
    width, height = img.size
    tile_width = width // cols
    tile_height = height // rows
    
    # Create tiles
    tiles = []
    for i in range(rows):
        for j in range(cols):
            box = (j * tile_width, i * tile_height, 
                   (j + 1) * tile_width, (i + 1) * tile_height)
            tiles.append(img.crop(box))
    
    # Shuffle tiles based on percentage
    num_to_shuffle = int(len(tiles) * percentage)
    indices = list(range(len(tiles)))
    shuffled_indices = indices.copy()
    random.shuffle(shuffled_indices[:num_to_shuffle])
    
    # Reconstruct image
    result = Image.new('RGB', (width, height))
    for idx, tile in enumerate(tiles):
        new_idx = shuffled_indices[idx]
        i = new_idx // cols
        j = new_idx % cols
        result.paste(tile, (j * tile_width, i * tile_height))
    
    return result


def scramble_color(img, params):
    """Scramble by shifting colors"""
    # Implement color scrambling
    return img


def scramble_rotation(img, params):
    """Scramble by rotating tiles"""
    # Implement rotation scrambling
    return img


def scramble_mirror(img, params):
    """Scramble by mirroring tiles"""
    # Implement mirror scrambling
    return img


def scramble_intensity(img, params):
    """Scramble by shifting intensity"""
    # Implement intensity scrambling
    return img


@app.route('/outputs/<filename>', methods=['GET'])
def serve_output(filename):
    """Serve scrambled images"""
    file_path = os.path.join(OUTPUTS_DIR, filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='image/jpeg')
    return jsonify({'error': 'File not found'}), 404


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### 2. Install Python Dependencies

```bash
pip install flask flask-cors pillow
```

### 3. Start Flask Service

```bash
cd python
python scrambler_service.py
```

You should see:
```
* Running on http://0.0.0.0:5000
```

## Frontend Usage

The frontend is already configured. Just:

1. Select an image file
2. Choose scrambling algorithm and parameters
3. Click "Scramble on Server"
4. View the scrambled result
5. Download or copy the unscramble key

## API Endpoints

### POST `/api/scramble-photo`

**Request:** Multipart form data
- `file`: Image file (required)
- `params`: JSON string with scrambling parameters (required)

**Response:**
```json
{
  "success": true,
  "output_file": "scrambled_image-123456.jpg",
  "scrambledImageUrl": "http://localhost:5000/outputs/scrambled_image-123456.jpg"
}
```

### GET `/api/download/:filename`

Download scrambled image file.

## Directory Structure

```
VideoScramblerApp/
├── python/
│   ├── inputs/          # Uploaded images (auto-created)
│   ├── outputs/         # Scrambled images (auto-created)
│   └── scrambler_service.py  # Flask service (create this)
├── old-server.cjs       # Express backend (updated)
└── src/
    └── pages/
        └── ScramblerPhotosPro.jsx  # Frontend (updated)
```

## Testing

1. **Start both servers:**
   ```bash
   # Terminal 1: Express backend
   node old-server.cjs
   
   # Terminal 2: Flask service
   cd python && python scrambler_service.py
   
   # Terminal 3: React frontend
   npm run dev
   ```

2. **Open browser:**
   - Navigate to the Scrambler page
   - Upload an image
   - Configure scrambling parameters
   - Click "Scramble on Server"
   - Verify both original and scrambled images display

## Troubleshooting

### "Python/Flask service is not running"
- Make sure Flask server is running on port 5000
- Check `FLASKAPP_LINK` in `.env` is correct

### "No image file provided"
- Check file input accepts images
- Verify file size is under 10MB

### Images not displaying
- Check CORS is enabled on Flask
- Verify `python/outputs` directory exists
- Check browser console for errors

### File upload fails
- Ensure `python/inputs` directory exists and is writable
- Check disk space

## Security Notes

- Add authentication before production
- Implement rate limiting
- Add virus scanning for uploaded files
- Set up proper file cleanup (delete old files)
- Use environment variables for all sensitive data
- Implement credit/payment system before going live
