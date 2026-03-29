// FingerprintRemover.jsx — Reverse a fingerprint transform given the userId / tracking number
// Uses the same warpImage() with applyInverse=true to undo the per-user warp.

import React, { useState, useRef } from 'react';
import {
  Container, Typography, Card, CardContent, Button, Box, Grid, Paper,
  Alert, CircularProgress, TextField, Divider, Tooltip
} from '@mui/material';
import {
  PhotoCamera, Fingerprint, Download, RestartAlt, Visibility
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';

// ============================================================
// FINGERPRINT TRANSFORM UTILITIES  (shared with PhotoUnscramblerPro)
// ============================================================

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromInt(n) {
  let x = (Number(n) >>> 0);
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17; x >>>= 0;
  x ^= x << 5; x >>>= 0;
  return x >>> 0;
}

function userIdToTrackingNumber(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(hash, 31) + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function paramsFromB(B) {
  const seed = seedFromInt(B);
  const rnd = mulberry32(seed);

  const angleDeg = (rnd() * 4) - 2;
  const angle = angleDeg * Math.PI / 180;
  const zoom = 1.15 + rnd() * 0.15;
  const shiftX = (rnd() * 2 - 1) * 30;
  const shiftY = (rnd() * 2 - 1) * 30;
  const cropTop = 16 + Math.floor(rnd() * 49);
  const cropRight = 16 + Math.floor(rnd() * 49);
  const cropBottom = 16 + Math.floor(rnd() * 49);
  const cropLeft = 16 + Math.floor(rnd() * 49);

  return { B, angle, angleDeg, zoom, shiftX, shiftY, cropTop, cropRight, cropBottom, cropLeft };
}

function sampleBilinear(src, x, y) {
  const w = src.width, h = src.height;
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return [0, 0, 0, 255];
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const dx = x - x0, dy = y - y0;
  const idx = (xx, yy) => (yy * w + xx) * 4;
  const p00 = idx(x0, y0), p10 = idx(x1, y0), p01 = idx(x0, y1), p11 = idx(x1, y1);
  const d = src.data;
  const out = [0, 0, 0, 255];
  for (let c = 0; c < 3; c++) {
    const v0 = d[p00 + c] * (1 - dx) + d[p10 + c] * dx;
    const v1 = d[p01 + c] * (1 - dx) + d[p11 + c] * dx;
    out[c] = v0 * (1 - dy) + v1 * dy;
  }
  return out;
}

function warpImage(srcImgData, params, applyInverse = false) {
  const w = srcImgData.width, h = srcImgData.height;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;

  const temp = new ImageData(w, h);
  const ang = applyInverse ? -params.angle : params.angle;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const zoom = params.zoom || 1.0;
  const sx = applyInverse ? -params.shiftX : params.shiftX;
  const sy = applyInverse ? -params.shiftY : params.shiftY;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = x - cx, py = y - cy;
      const rx = px * ca - py * sa;
      const ry = px * sa + py * ca;
      const zx = applyInverse ? rx * zoom : rx / zoom;
      const zy = applyInverse ? ry * zoom : ry / zoom;
      const p = sampleBilinear(srcImgData, zx - sx + cx, zy - sy + cy);
      temp.data[i] = p[0]; temp.data[i + 1] = p[1]; temp.data[i + 2] = p[2]; temp.data[i + 3] = 255;
    }
  }

  const cropT = 0, cropR = 0, cropB2 = 0, cropL = 0;
  const cW = w - cropL - cropR, cH = h - cropT - cropB2;
  const cropped = new ImageData(cW, cH);
  for (let y = 0; y < cH; y++) {
    for (let x = 0; x < cW; x++) {
      const si = ((y + cropT) * w + (x + cropL)) * 4;
      const di = (y * cW + x) * 4;
      cropped.data[di] = temp.data[si];
      cropped.data[di + 1] = temp.data[si + 1];
      cropped.data[di + 2] = temp.data[si + 2];
      cropped.data[di + 3] = 255;
    }
  }

  const out = new ImageData(w, h);
  const scX = cW / w, scY = cH / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const p = sampleBilinear(cropped, x * scX, y * scY);
      out.data[i] = p[0]; out.data[i + 1] = p[1]; out.data[i + 2] = p[2]; out.data[i + 3] = 255;
    }
  }
  return out;
}

// ============================================================
// REVERSE fingerprint: inverse of applyFingerprintTransform
// ============================================================
async function reverseFingerprintTransform(imageBlob, userId) {
  const blobUrl = URL.createObjectURL(imageBlob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = blobUrl;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const B = userIdToTrackingNumber(userId);
    const params = paramsFromB(B);
    const warped = warpImage(imgData, params, true); // applyInverse = true

    ctx.putImageData(warped, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), params };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

// ============================================================
// COMPONENT
// ============================================================
export default function FingerprintRemover() {
  const { success, error } = useToast();

  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [userId, setUserId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState(null);
  const [resultParams, setResultParams] = useState(null);

  // ---- file handling ----
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      error('Please select a valid image file');
      return;
    }
    setSelectedFile(file);
    setResultUrl(null);
    setResultParams(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // ---- main action ----
  const handleRemoveFingerprint = async () => {
    if (!selectedFile) { error('Please select a fingerprinted image first'); return; }
    if (!userId.trim()) { error('Please enter the User ID used for fingerprinting'); return; }

    setIsProcessing(true);
    try {
      const { dataUrl, params } = await reverseFingerprintTransform(selectedFile, userId.trim());
      setResultUrl(dataUrl);
      setResultParams(params);
      success('Fingerprint transform reversed successfully!');
    } catch (err) {
      console.error('Reverse fingerprint error:', err);
      error('Failed to reverse fingerprint: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- download ----
  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `restored_${selectedFile?.name?.replace(/\.[^/.]+$/, '') || 'image'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    success('Restored image downloaded!');
  };

  // ---- reset ----
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUserId('');
    setResultUrl(null);
    setResultParams(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        <Fingerprint sx={{ mr: 1, verticalAlign: 'middle' }} />
        Fingerprint Remover
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Reverse the fingerprint transform applied during unscrambling. Provide the
        fingerprinted image and the <strong>User ID</strong> that was used when the
        fingerprint was embedded.
      </Typography>

      {/* ---------- INPUT CARD ---------- */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>1. Select Fingerprinted Image</Typography>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileSelect}
          />
          <Button
            variant="outlined"
            startIcon={<PhotoCamera />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ mb: 2 }}
          >
            {selectedFile ? selectedFile.name : 'Choose Image'}
          </Button>

          {previewUrl && (
            <Box sx={{ mt: 1, mb: 2, textAlign: 'center' }}>
              <img
                src={previewUrl}
                alt="Fingerprinted preview"
                style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, border: '1px solid #444' }}
              />
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>2. Enter Watermark Parameter (User ID)</Typography>
          <TextField
            fullWidth
            label="User ID"
            placeholder="e.g. A3F9KQ12XB"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            helperText="The 10-character user ID that was used to generate the fingerprint."
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <RestartAlt />}
              onClick={handleRemoveFingerprint}
              disabled={isProcessing || !selectedFile || !userId.trim()}
            >
              {isProcessing ? 'Processing…' : 'Remove Fingerprint'}
            </Button>

            <Button variant="outlined" color="secondary" onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* ---------- RESULT CARD ---------- */}
      {resultUrl && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <Visibility sx={{ mr: 1, verticalAlign: 'middle' }} />
              Restored Image
            </Typography>

            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <img
                src={resultUrl}
                alt="Restored (fingerprint removed)"
                style={{ maxWidth: '100%', maxHeight: 500, borderRadius: 8, border: '1px solid #444' }}
              />
            </Box>

            <Button
              variant="contained"
              color="success"
              startIcon={<Download />}
              onClick={handleDownload}
            >
              Download Restored Image
            </Button>

            {resultParams && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="info" variant="outlined">
                  <Typography variant="subtitle2" gutterBottom>Transform parameters that were reversed:</Typography>
                  <Typography variant="body2">
                    Tracking # (B): <strong>{resultParams.B}</strong> &nbsp;|&nbsp;
                    Angle: <strong>{resultParams.angleDeg.toFixed(2)}°</strong> &nbsp;|&nbsp;
                    Zoom: <strong>{resultParams.zoom.toFixed(3)}x</strong> &nbsp;|&nbsp;
                    Shift: <strong>({resultParams.shiftX.toFixed(1)}, {resultParams.shiftY.toFixed(1)})</strong>
                  </Typography>
                </Alert>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
