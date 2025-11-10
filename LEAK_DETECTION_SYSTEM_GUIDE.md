# Steganography Leak Detection System - Complete Implementation Guide

This document contains all the code needed to implement a complete steganography-based leak detection system for photos and videos.

## System Overview

### Architecture Flow:
1. **Frontend (React)** → Upload media file
2. **Node.js Backend** → Receive file, save to upload folder
3. **Python Flask** → Extract steganographic code from file
4. **Node.js Backend** → Search database for matching code
5. **Frontend (React)** → Display leak detection results

---

## 1. DATABASE SCHEMA

### Create `watermark_codes` table:

```sql
CREATE TABLE `watermark_codes` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `user_id` VARCHAR(10) NOT NULL,
  `username` VARCHAR(50),
  `filename` VARCHAR(255),
  `media_type` ENUM('image', 'video') NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `purchase_id` VARCHAR(36),
  `device_fingerprint` TEXT,
  `scramble_params` JSON,
  INDEX idx_code (code),
  INDEX idx_user_id (user_id),
  INDEX idx_media_type (media_type),
  FOREIGN KEY (user_id) REFERENCES userData(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Sample data for testing:

```sql
INSERT INTO watermark_codes (code, user_id, username, filename, media_type, purchase_id, device_fingerprint) VALUES
('STEG_12345_ABCDE', 'user_001', 'john_doe', 'vacation_photo.jpg', 'image', 'purch_001', 'fp_device_12345'),
('STEG_67890_FGHIJ', 'user_002', 'jane_smith', 'family_video.mp4', 'video', 'purch_002', 'fp_device_67890'),
('STEG_11111_KKKKK', 'user_003', 'bob_jones', 'sunset.png', 'image', 'purch_003', 'fp_device_11111');
```

---

## 2. PYTHON FLASK ENDPOINTS (app.py)

Add these endpoints to your existing `app.py`:

```python
# At the top of app.py, add these imports:
from PIL import Image
import numpy as np
import hashlib

# Steganography extraction function
def extract_steganographic_code(image_path):
    """
    Extract hidden steganographic code from an image using LSB (Least Significant Bit) method.
    This is a simplified example - you can use more advanced libraries like stegano, stepic, etc.
    """
    try:
        img = Image.open(image_path)
        img_array = np.array(img)
        
        # Extract LSB from RGB channels
        # This is a placeholder - implement your actual steganography algorithm
        # For demo purposes, we'll extract metadata or generate a hash
        
        # Method 1: Check for metadata
        metadata = img.info
        if 'watermark_code' in metadata:
            return metadata['watermark_code']
        
        # Method 2: Generate deterministic hash based on image properties
        # This simulates finding a code (replace with actual steganography)
        img_hash = hashlib.md5(img_array.tobytes()).hexdigest()[:20]
        extracted_code = f"STEG_{img_hash[:5].upper()}_{img_hash[5:10].upper()}"
        
        return extracted_code
    
    except Exception as e:
        print(f"Error extracting code: {e}")
        return None

def extract_video_steganographic_code(video_path):
    """
    Extract hidden steganographic code from a video file.
    For videos, we typically extract from the first frame or audio track.
    """
    try:
        import cv2
        
        # Open video file
        cap = cv2.VideoCapture(video_path)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return None
        
        # Convert frame to PIL Image for processing
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        # Check metadata
        # (In production, you'd extract from actual embedded steganographic data)
        
        # Generate deterministic code based on first frame
        frame_hash = hashlib.md5(frame_rgb.tobytes()).hexdigest()[:20]
        extracted_code = f"STEG_{frame_hash[:5].upper()}_{frame_hash[5:10].upper()}"
        
        return extracted_code
    
    except Exception as e:
        print(f"Error extracting video code: {e}")
        return None

# Photo leak detection endpoint
@app.route('/extract-photo-code', methods=['POST'])
def extract_photo_code():
    """
    Extract steganographic code from an uploaded photo
    """
    print("\\n" + "="*60)
    print("🔍 FLASK: Extract photo code request received")
    print("="*60)
    
    try:
        data = request.json
        if not data:
            print("❌ FLASK ERROR: No JSON data provided")
            return jsonify({'error': 'No JSON data provided'}), 400
        
        input_file = data.get('input')
        
        if not input_file:
            print("❌ FLASK ERROR: No input filename provided")
            return jsonify({'error': 'input filename required'}), 400
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], input_file)
        
        print(f"📁 FLASK: Input path: {input_path}")
        
        if not os.path.exists(input_path):
            print(f"❌ FLASK ERROR: Input file not found at: {input_path}")
            return jsonify({'error': f'Input file {input_file} not found'}), 404
        
        print("✅ FLASK: Input file exists, extracting code...")
        
        # Extract steganographic code
        extracted_code = extract_steganographic_code(input_path)
        
        if not extracted_code:
            print("⚠️  FLASK: No code extracted")
            return jsonify({
                'success': False,
                'extracted_code': None,
                'message': 'No steganographic code found in image'
            }), 200
        
        print(f"✅ FLASK: Code extracted successfully: {extracted_code}")
        print("="*60 + "\\n")
        
        return jsonify({
            'success': True,
            'extracted_code': extracted_code,
            'message': 'Code extracted successfully'
        }), 200
    
    except Exception as e:
        print(f"❌ FLASK ERROR: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        print("="*60 + "\\n")
        return jsonify({'error': str(e)}), 500

# Video leak detection endpoint
@app.route('/extract-video-code', methods=['POST'])
def extract_video_code():
    """
    Extract steganographic code from an uploaded video
    """
    print("\\n" + "="*60)
    print("🎥 FLASK: Extract video code request received")
    print("="*60)
    
    try:
        data = request.json
        if not data:
            print("❌ FLASK ERROR: No JSON data provided")
            return jsonify({'error': 'No JSON data provided'}), 400
        
        input_file = data.get('input')
        
        if not input_file:
            print("❌ FLASK ERROR: No input filename provided")
            return jsonify({'error': 'input filename required'}), 400
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], input_file)
        
        print(f"📁 FLASK: Input path: {input_path}")
        
        if not os.path.exists(input_path):
            print(f"❌ FLASK ERROR: Input file not found at: {input_path}")
            return jsonify({'error': f'Input file {input_file} not found'}), 404
        
        print("✅ FLASK: Input file exists, extracting code...")
        
        # Extract steganographic code from video
        extracted_code = extract_video_steganographic_code(input_path)
        
        if not extracted_code:
            print("⚠️  FLASK: No code extracted")
            return jsonify({
                'success': False,
                'extracted_code': None,
                'message': 'No steganographic code found in video'
            }), 200
        
        print(f"✅ FLASK: Code extracted successfully: {extracted_code}")
        print("="*60 + "\\n")
        
        return jsonify({
            'success': True,
            'extracted_code': extracted_code,
            'message': 'Code extracted successfully'
        }), 200
    
    except Exception as e:
        print(f"❌ FLASK ERROR: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        print("="*60 + "\\n")
        return jsonify({'error': str(e)}), 500
```

### Install required Python packages:

```bash
pip install opencv-python pillow numpy
```

---

## 3. NODE.JS BACKEND ENDPOINTS (server.cjs)

Add these endpoints to your existing `server.cjs`:

```javascript
// Photo leak detection endpoint
server.post('/api/check-photo-leak', async (req, res) => {
  console.log('\\n' + '='.repeat(60));
  console.log('🔍 NODE: Photo leak check request received');
  console.log('='.repeat(60));
  
  // Setup multer for this endpoint if not already configured
  const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });
  
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('❌ NODE ERROR: Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const filename = req.file.filename;
      console.log(`📤 NODE: File saved as: ${filename}`);
      
      // Step 1: Send to Flask to extract steganographic code
      console.log('📡 NODE: Sending to Flask for code extraction...');
      
      const flaskResponse = await axios.post(
        `${FLASKAPP_LINK}/extract-photo-code`,
        {
          input: filename
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      
      const { extracted_code } = flaskResponse.data;
      
      console.log(`🔑 NODE: Extracted code: ${extracted_code || 'None'}`);
      
      if (!extracted_code) {
        return res.json({
          leakDetected: false,
          extractedCode: null,
          message: 'No steganographic code found in image'
        });
      }
      
      // Step 2: Search database for matching code
      console.log('🔍 NODE: Searching database for matching code...');
      
      const [rows] = await pool.query(
        \`SELECT 
          wc.*,
          ud.username,
          ud.email,
          p.id as purchase_id,
          p.createdAt as purchase_date
        FROM watermark_codes wc
        LEFT JOIN userData ud ON wc.user_id = ud.id
        LEFT JOIN purchases p ON wc.purchase_id = p.id
        WHERE wc.code = ?\`,
        [extracted_code]
      );
      
      if (rows.length === 0) {
        console.log('✅ NODE: No match found in database - image is clean');
        return res.json({
          leakDetected: false,
          extractedCode: extracted_code,
          message: 'Code extracted but not found in database'
        });
      }
      
      // Step 3: Leak detected! Return details
      const leakData = rows[0];
      console.log('🚨 NODE: LEAK DETECTED!');
      console.log(`   User: ${leakData.username} (${leakData.user_id})`);
      console.log(`   File: ${leakData.filename}`);
      
      // Cleanup: delete uploaded file
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.warn('⚠️  Could not delete uploaded file:', cleanupErr);
      }
      
      console.log('='.repeat(60) + '\\n');
      
      return res.json({
        leakDetected: true,
        extractedCode: extracted_code,
        leakData: {
          id: leakData.id,
          code: leakData.code,
          user_id: leakData.user_id,
          username: leakData.username,
          email: leakData.email,
          filename: leakData.filename,
          media_type: leakData.media_type,
          created_at: leakData.created_at,
          purchase_id: leakData.purchase_id,
          purchase_date: leakData.purchase_date,
          device_fingerprint: leakData.device_fingerprint
        },
        message: 'Leak detected! Original owner identified.'
      });
      
    } catch (error) {
      console.error('❌ NODE ERROR:', error);
      console.log('='.repeat(60) + '\\n');
      
      // Cleanup on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupErr) {
          console.warn('⚠️  Could not delete uploaded file:', cleanupErr);
        }
      }
      
      return res.status(500).json({
        error: error.message,
        details: error.response?.data
      });
    }
  });
});

// Video leak detection endpoint
server.post('/api/check-video-leak', async (req, res) => {
  console.log('\\n' + '='.repeat(60));
  console.log('🎥 NODE: Video leak check request received');
  console.log('='.repeat(60));
  
  const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only video files are allowed'));
      }
    }
  });
  
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('❌ NODE ERROR: Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const filename = req.file.filename;
      console.log(`📤 NODE: File saved as: ${filename}`);
      
      // Step 1: Send to Flask to extract steganographic code
      console.log('📡 NODE: Sending to Flask for code extraction...');
      
      const flaskResponse = await axios.post(
        `${FLASKAPP_LINK}/extract-video-code`,
        {
          input: filename
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000 // 60 seconds for video processing
        }
      );
      
      const { extracted_code } = flaskResponse.data;
      
      console.log(`🔑 NODE: Extracted code: ${extracted_code || 'None'}`);
      
      if (!extracted_code) {
        return res.json({
          leakDetected: false,
          extractedCode: null,
          message: 'No steganographic code found in video'
        });
      }
      
      // Step 2: Search database
      console.log('🔍 NODE: Searching database for matching code...');
      
      const [rows] = await pool.query(
        \`SELECT 
          wc.*,
          ud.username,
          ud.email,
          p.id as purchase_id,
          p.createdAt as purchase_date
        FROM watermark_codes wc
        LEFT JOIN userData ud ON wc.user_id = ud.id
        LEFT JOIN purchases p ON wc.purchase_id = p.id
        WHERE wc.code = ?\`,
        [extracted_code]
      );
      
      if (rows.length === 0) {
        console.log('✅ NODE: No match found in database - video is clean');
        return res.json({
          leakDetected: false,
          extractedCode: extracted_code,
          message: 'Code extracted but not found in database'
        });
      }
      
      // Step 3: Leak detected!
      const leakData = rows[0];
      console.log('🚨 NODE: LEAK DETECTED!');
      console.log(`   User: ${leakData.username} (${leakData.user_id})`);
      
      // Cleanup
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.warn('⚠️  Could not delete uploaded file:', cleanupErr);
      }
      
      console.log('='.repeat(60) + '\\n');
      
      return res.json({
        leakDetected: true,
        extractedCode: extracted_code,
        leakData: {
          id: leakData.id,
          code: leakData.code,
          user_id: leakData.user_id,
          username: leakData.username,
          email: leakData.email,
          filename: leakData.filename,
          media_type: leakData.media_type,
          created_at: leakData.created_at,
          purchase_id: leakData.purchase_id,
          purchase_date: leakData.purchase_date,
          device_fingerprint: leakData.device_fingerprint
        },
        message: 'Leak detected! Original owner identified.'
      });
      
    } catch (error) {
      console.error('❌ NODE ERROR:', error);
      console.log('='.repeat(60) + '\\n');
      
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupErr) {}
      }
      
      return res.status(500).json({
        error: error.message,
        details: error.response?.data
      });
    }
  });
});
```

---

## 4. TESTING THE SYSTEM

### Test the complete flow:

1. **Insert test data:**
```sql
INSERT INTO watermark_codes (code, user_id, username, filename, media_type) 
VALUES ('STEG_12345_ABCDE', 'user_001', 'test_user', 'test_image.jpg', 'image');
```

2. **Test with curl:**
```bash
# Test photo leak detection
curl -X POST http://localhost:3001/api/check-photo-leak \\
  -F "file=@/path/to/test/image.jpg"

# Test video leak detection
curl -X POST http://localhost:3001/api/check-video-leak \\
  -F "file=@/path/to/test/video.mp4"
```

3. **Use the React frontend** to upload files through the UI

---

## 5. ADVANCED STEGANOGRAPHY LIBRARIES

For production use, consider these Python libraries:

```bash
# LSB Steganography
pip install stegano

# Advanced steganography
pip install stepic

# Invisible watermarking
pip install invisible-watermark
```

### Example with stegano library:

```python
from stegano import lsb

def extract_steganographic_code(image_path):
    try:
        # Extract hidden message
        hidden_message = lsb.reveal(image_path)
        return hidden_message
    except Exception as e:
        return None
```

---

## NOTES:

1. **Security**: The current implementation uses MD5 hashing for demo purposes. In production:
   - Use actual steganography embedding during scrambling
   - Implement proper LSB extraction
   - Consider using invisible watermarking

2. **Performance**: Video processing can be slow. Consider:
   - Processing only key frames
   - Using async/queue systems for large files
   - Implementing progress callbacks

3. **Storage**: Uploaded files are temporarily stored in `uploads/` folder
   - Implement automatic cleanup (cron job)
   - Set file retention policies
   - Monitor disk usage

4. **Database Indexing**: The `watermark_codes` table has indexes on:
   - `code` (most important for fast lookups)
   - `user_id`
   - `media_type`

---

END OF DOCUMENTATION
