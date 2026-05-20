// PhotoUnscramblerStandardCS.jsx — Client-Side Standard Photo Unscrambler
// Reverses scrambling done by PhotoScramblerStandardCS.jsx (version "standard-cs").
// Fingerprint transform applied after unscrambling for tracking.

import React, { useState, useRef, useCallback } from 'react';
import {
    Container, Typography, Card, CardContent, Button, TextField,
    Box, Grid, Chip, Alert, CircularProgress, Divider, Paper
} from '@mui/material';
import {
    PhotoCamera, LockOpen, Download, VpnKey, AutoAwesome, CheckCircle, Upload
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

// ═══════════════════════════════════════════════════════
// FINGERPRINT TRANSFORM UTILITIES (verbatim from PhotoUnscramblerProCS)
// ═══════════════════════════════════════════════════════

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
    x ^= x << 5;  x >>>= 0;
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
    const angle    = angleDeg * Math.PI / 180;
    const zoom     = 1.02 + rnd() * 0.05;
    const shiftX   = (rnd() * 2 - 1) * 12;
    const shiftY   = (rnd() * 2 - 1) * 12;
    const cropTop    = 16 + Math.floor(rnd() * 16);
    const cropRight  = 16 + Math.floor(rnd() * 16);
    const cropBottom = 16 + Math.floor(rnd() * 16);
    const cropLeft   = 16 + Math.floor(rnd() * 16);
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
    const ang  = applyInverse ? -params.angle : params.angle;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const zoom = params.zoom || 1.0;
    const sx = applyInverse ? -params.shiftX : params.shiftX;
    const sy = applyInverse ? -params.shiftY : params.shiftY;

    const temp = new ImageData(w, h);
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
            cropped.data[di]     = temp.data[si];
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

async function applyFingerprintTransform(imageBlob, userId) {
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
        const warped = warpImage(imgData, params, false);
        ctx.putImageData(warped, 0, 0);
        return {
            dataUrl: canvas.toDataURL('image/png'),
            params: {
                trackingNumber: String(B),
                angleDeg:  params.angleDeg.toFixed(2),
                zoom:      params.zoom.toFixed(3),
                shiftX:    params.shiftX.toFixed(1),
                shiftY:    params.shiftY.toFixed(1),
            }
        };
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

// ═══════════════════════════════════════════════════════
// STANDARD UNSCRAMBLE ALGORITHM (pure functions)
// ═══════════════════════════════════════════════════════

function seededPermutation(size, seed) {
    const rnd = mulberry32(seed >>> 0);
    const arr = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function invertPermArr(perm) {
    const inv = new Array(perm.length);
    for (let i = 0; i < perm.length; i++) inv[perm[i]] = i;
    return inv;
}

function extractTile(pixels, imgW, x0, y0, tileW, tileH) {
    const t = new Uint8ClampedArray(tileW * tileH * 4);
    for (let r = 0; r < tileH; r++)
        for (let c = 0; c < tileW; c++) {
            const si = ((y0 + r) * imgW + (x0 + c)) * 4;
            const di = (r * tileW + c) * 4;
            t[di] = pixels[si]; t[di + 1] = pixels[si + 1];
            t[di + 2] = pixels[si + 2]; t[di + 3] = pixels[si + 3];
        }
    return t;
}

function placeTile(pixels, imgW, x0, y0, tile, tileW, tileH) {
    for (let r = 0; r < tileH; r++)
        for (let c = 0; c < tileW; c++) {
            const si = (r * tileW + c) * 4;
            const di = ((y0 + r) * imgW + (x0 + c)) * 4;
            pixels[di] = tile[si]; pixels[di + 1] = tile[si + 1];
            pixels[di + 2] = tile[si + 2]; pixels[di + 3] = tile[si + 3];
        }
}

/** Flip a tile. mode: 0=none, 1=H, 2=V, 3=both. Self-inverse. */
function flipTile(tile, tileW, tileH, mode) {
    if (mode === 0) return tile;
    const out = new Uint8ClampedArray(tile.length);
    for (let r = 0; r < tileH; r++)
        for (let c = 0; c < tileW; c++) {
            const sr = (mode & 2) ? tileH - 1 - r : r;
            const sc = (mode & 1) ? tileW - 1 - c : c;
            const si = (sr * tileW + sc) * 4;
            const di = (r * tileW + c) * 4;
            out[di] = tile[si]; out[di + 1] = tile[si + 1];
            out[di + 2] = tile[si + 2]; out[di + 3] = tile[si + 3];
        }
    return out;
}

// ─── noise removal ───────────────────────────────────────────────────────────

function generateNoiseTileOffsets(tileSize, noiseSeed, intensity) {
    const rnd = mulberry32(noiseSeed >>> 0);
    const offsets = new Int16Array(tileSize * tileSize * 3);
    for (let p = 0; p < tileSize * tileSize; p++) {
        const b = p * 3;
        offsets[b]     = Math.round((rnd() * 2 - 1) * intensity);
        offsets[b + 1] = Math.round((rnd() * 2 - 1) * intensity);
        offsets[b + 2] = Math.round((rnd() * 2 - 1) * intensity);
    }
    return offsets;
}

function applyNoiseSub(pixels, w, h, offsets, tileSize) {
    const out = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < h; y++) {
        const ty = y % tileSize;
        for (let x = 0; x < w; x++) {
            const ti = (ty * tileSize + (x % tileSize)) * 3;
            const pi = (y * w + x) * 4;
            out[pi]     = (pixels[pi]     - offsets[ti]     + 256) & 0xFF;
            out[pi + 1] = (pixels[pi + 1] - offsets[ti + 1] + 256) & 0xFF;
            out[pi + 2] = (pixels[pi + 2] - offsets[ti + 2] + 256) & 0xFF;
            out[pi + 3] = pixels[pi + 3];
        }
    }
    return out;
}

// ─── key decode ──────────────────────────────────────────────────────────────

function decodeKey(rawKey) {
    const s = rawKey.trim();
    let parsed = null;

    // Try plain JSON first
    try { parsed = JSON.parse(s); } catch (_) {}
    // Try base64 decode
    if (!parsed) {
        try { parsed = JSON.parse(atob(s)); } catch (_) {}
    }

    if (!parsed) throw new Error('Key is not valid JSON or base64-encoded JSON.');
    if (parsed.type !== 'photo') throw new Error('This is not a photo unscramble key.');
    if (parsed.version !== 'standard-cs') {
        throw new Error(
            parsed.version
                ? `Key version "${parsed.version}" is not compatible. Use the correct unscrambler for that version.`
                : 'Invalid key: missing version field.'
        );
    }
    if (parsed.algorithm !== 'position_mirror') {
        throw new Error(
            parsed.algorithm
                ? `Key algorithm "${parsed.algorithm}" is not supported by this unscrambler.`
                : 'Invalid key: missing algorithm field.'
        );
    }
    return parsed;
}

// ─── unscramble (position + flip, single algorithm) ──────────────────────────
// Inverse of: scrambled[dest] = flip(perm[dest] % 4, original[perm[dest]])
// For each original position orig:  original[orig] = flip(orig % 4, scrambled[invPerm[orig]])

function standardUnscramble(imgData, keyData) {
    const { data: src, width: W, height: H } = imgData;
    const { rows: n, cols: m, noise } = keyData;

    let pixels = new Uint8ClampedArray(src);

    // 1. Remove noise first (inverse of last scramble step)
    if (noise && noise.intensity > 0 && noise.seed != null && noise.tile_size) {
        pixels = applyNoiseSub(pixels, W, H,
            generateNoiseTileOffsets(noise.tile_size, noise.seed, noise.intensity),
            noise.tile_size);
    }

    const tileW = Math.floor(W / m), tileH = Math.floor(H / n);
    const N = n * m;

    const perm = (keyData.perm1based || []).map(x => x - 1); // 0-based: perm[dest] = src
    if (perm.length !== N) throw new Error(`perm1based length ${perm.length} does not match grid ${N}`);
    const invPerm = invertPermArr(perm); // invPerm[src] = dest

    // Extract all tiles from the scrambled image
    const scrambledTiles = [];
    for (let r = 0; r < n; r++)
        for (let c = 0; c < m; c++)
            scrambledTiles.push(extractTile(pixels, W, c * tileW, r * tileH, tileW, tileH));

    // Restore: for each original position orig, apply flip(orig % 4, scrambledTiles[invPerm[orig]])
    const outPx = new Uint8ClampedArray(W * H * 4);
    for (let i = 3; i < outPx.length; i += 4) outPx[i] = 255;
    for (let orig = 0; orig < N; orig++) {
        const scrambledPos = invPerm[orig];
        const restored = flipTile(scrambledTiles[scrambledPos], tileW, tileH, orig % 4);
        const r = Math.floor(orig / m), c = orig % m;
        placeTile(outPx, W, c * tileW, r * tileH, restored, tileW, tileH);
    }

    return { pixels: outPx, w: W, h: H };
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export default function PhotoUnscramblerStandardCS() {
    const { success, error, info } = useToast();

    const fileInputRef        = useRef(null);
    const keyFileInputRef     = useRef(null);
    const imageRef            = useRef(null);
    const unscrambleImageRef  = useRef(null);

    // File
    const [selectedFile, setSelectedFile]       = useState(null);
    const [previewUrl, setPreviewUrl]           = useState('');
    const [imageLoaded, setImageLoaded]         = useState(false);

    // Key
    const [keyText, setKeyText]                 = useState('');
    const [decodedKey, setDecodedKey]           = useState(null);
    const [keyError, setKeyError]               = useState('');

    // Results
    const [unscrambledUrl, setUnscrambledUrl]   = useState('');
    const [fingerprintedUrl, setFingerprintedUrl] = useState('');
    const [fingerprintParams, setFingerprintParams] = useState(null);

    // Credits / processing
    const [isProcessing, setIsProcessing]       = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [actionCost, setActionCost]           = useState(10);
    const [scrambleLevel, setScrambleLevel]     = useState(1);
    const [userData] = useState(() => JSON.parse(localStorage.getItem('userdata') || 'null'));
    const [userCredits] = useState(0);

    // ─── file handling ─────────────────────────────────────────────────────
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { error('Please select an image file'); return; }
        setSelectedFile(file);
        setUnscrambledUrl('');
        setFingerprintedUrl('');
        setFingerprintParams(null);
        setImageLoaded(false);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        const img = imageRef.current;
        if (img) {
            img.onload = () => { setImageLoaded(true); };
            img.onerror = () => error('Failed to load image');
            img.src = url;
        }
    };

    const handleKeyFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result?.trim() ?? '';
            setKeyText(text);
            tryDecodeKey(text);
        };
        reader.readAsText(file);
    };

    // ─── key decode ────────────────────────────────────────────────────────
    const tryDecodeKey = (text) => {
        setKeyError('');
        setDecodedKey(null);
        if (!text.trim()) return;
        try {
            const k = decodeKey(text);
            setDecodedKey(k);
            success('Key decoded successfully!');
        } catch (err) {
            setKeyError(err.message);
            error(err.message);
        }
    };

    // ─── credit helpers ────────────────────────────────────────────────────
    const confirmSpendingCredits = () => {
        if (!imageLoaded) { error('Please select a scrambled image first'); return; }
        if (!decodedKey) { error('Please load and decode a valid key first'); return; }
        setScrambleLevel(Math.max(decodedKey.rows ?? 1, decodedKey.cols ?? 1));
        setShowCreditModal(true);
    };

    const handleCreditConfirm = useCallback((actualCostSpent) => {
        setShowCreditModal(false);
        setActionCost(actualCostSpent);
        setTimeout(() => { unscrambleImageRef.current(actualCostSpent); }, 0);
    }, []);

    const handleRefundCredits = async () => {
        await refundCredits({
            userId: userData?.id, username: userData?.username, email: userData?.email,
            credits: actionCost, currentCredits: userCredits,
            password: localStorage.getItem('hashedPassword'),
            action: 'unscramble-photo-standard-cs',
        }).catch(() => {});
        error('Unscrambling failed. Credits refunded.');
    };

    // ─── main unscramble ────────────────────────────────────────────────────
    const unscrambleImage = useCallback(async (cost) => {
        if (!selectedFile || !imageRef.current?.naturalWidth) {
            error('Please select a scrambled image'); return;
        }
        if (!decodedKey) { error('Please decode a key first'); return; }
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 50));

        try {
            const img = imageRef.current;
            const W = img.naturalWidth, H = img.naturalHeight;
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = H;
            canvas.getContext('2d').drawImage(img, 0, 0);
            const imgData = canvas.getContext('2d').getImageData(0, 0, W, H);

            const { pixels, w, h } = standardUnscramble(imgData, decodedKey);

            const outCanvas = document.createElement('canvas');
            outCanvas.width = w; outCanvas.height = h;
            outCanvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);

            // Unscrambled data URL (no fingerprint)
            const rawDataUrl = outCanvas.toDataURL('image/png');
            setUnscrambledUrl(rawDataUrl);

            // Fingerprint transform
            const rawBlob = await (await fetch(rawDataUrl)).blob();
            const fpResult = await applyFingerprintTransform(rawBlob, String(userData?.id ?? '0'));
            setFingerprintedUrl(fpResult.dataUrl);
            setFingerprintParams(fpResult.params);

            api.post('/api/analytics/scramble-event', {
                username: userData?.username, userId: userData?.id,
                scrambleType: 'photo-unscramble-standard-cs',
                scrambleLevel, timestamp: new Date().toISOString(), actionCost: cost,
                mediaDetails: { name: selectedFile.name, size: selectedFile.size, width: W, height: H },
            }).catch(() => {});

            success('Image unscrambled successfully!');
            setTimeout(() => info(`${cost} credits spent.`), 1500);
        } catch (err) {
            console.error('Unscramble error:', err);
            error('Unscrambling failed: ' + err.message);
            handleRefundCredits();
        } finally {
            setIsProcessing(false);
        }
    }, [selectedFile, decodedKey, userData, scrambleLevel]);

    unscrambleImageRef.current = unscrambleImage;

    // ─── downloads ─────────────────────────────────────────────────────────
    const downloadFingerprintedImage = () => {
        if (!fingerprintedUrl) { error('Unscramble an image first'); return; }
        const a = document.createElement('a');
        a.href = fingerprintedUrl;
        a.download = `unscrambled_${selectedFile?.name?.replace(/\.[^/.]+$/, '') ?? 'photo'}_${Date.now()}.png`;
        a.click();
        success('Unscrambled image downloaded!');
    };

    const downloadRawImage = () => {
        if (!unscrambledUrl) { error('Unscramble an image first'); return; }
        const a = document.createElement('a');
        a.href = unscrambledUrl;
        a.download = `unscrambled_raw_${selectedFile?.name?.replace(/\.[^/.]+$/, '') ?? 'photo'}_${Date.now()}.png`;
        a.click();
        success('Raw unscrambled image downloaded!');
    };

    const algorithmDescriptions = {
        position_mirror: 'Tile position shuffle + per-tile flip',
    };

    return (
        <Container sx={{ py: 4 }}>
            <img ref={imageRef} style={{ display: 'none' }} alt="" crossOrigin="anonymous" />

            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ mb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <LockOpen /> 🔓 Photo Unscrambler Standard
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Client-side version — reverses PhotoScramblerStandardCS keys
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="Client-Side" size="small" color="success" />
                    <Chip label="Tile Shuffle + Flip" size="small" color="primary" />
                    <Chip label="Fingerprinted" size="small" color="secondary" />
                    <Chip label="No Upload" size="small" />
                </Box>
            </Box>

            {/* ── Step 1: Load scrambled image ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>Step 1</Typography>
                        <Typography variant="h6">Load Scrambled Image</Typography>
                    </Box>
                    <input type="file" accept="image/*" onChange={handleFileSelect}
                        style={{ display: 'none' }} id="cs-std-unscramble-img" ref={fileInputRef} />
                    <label htmlFor="cs-std-unscramble-img">
                        <Button variant="contained" component="span" startIcon={<PhotoCamera />}
                            sx={{ backgroundColor: '#2196f3' }}>
                            Select Scrambled Image
                        </Button>
                    </label>
                    {selectedFile && (
                        <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                            ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </Typography>
                    )}
                    {previewUrl && (
                        <Box sx={{ mt: 2 }}>
                            <img src={previewUrl} alt="Scrambled Preview"
                                style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, border: '1px solid #666' }} />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ── Step 2: Load key ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>Step 2</Typography>
                        <Typography variant="h6">Load Unscramble Key</Typography>
                    </Box>

                    <input type="file" accept=".txt,.json" onChange={handleKeyFileSelect}
                        style={{ display: 'none' }} id="cs-std-key-file" ref={keyFileInputRef} />
                    <label htmlFor="cs-std-key-file">
                        <Button variant="outlined" component="span" startIcon={<Upload />}
                            sx={{ color: '#22d3ee', borderColor: '#22d3ee', mb: 2 }}>
                            Load Key File
                        </Button>
                    </label>

                    <TextField fullWidth multiline rows={3} label="Or paste key here"
                        value={keyText} onChange={e => setKeyText(e.target.value)}
                        InputProps={{ sx: { backgroundColor: '#252525', color: '#a5f3fc', fontFamily: 'monospace', fontSize: '0.75rem' } }}
                        InputLabelProps={{ sx: { color: '#ccc' } }}
                        sx={{ mb: 2 }} />

                    <Button variant="contained" startIcon={<VpnKey />}
                        onClick={() => tryDecodeKey(keyText)}
                        disabled={!keyText.trim()}
                        sx={{ backgroundColor: '#0369a1' }}>
                        Decode Key
                    </Button>

                    {keyError && (
                        <Alert severity="error" sx={{ mt: 2, backgroundColor: '#4a0000', color: '#fca5a5' }}>
                            {keyError}
                        </Alert>
                    )}
{/* 
                    {decodedKey && (
                        <Alert severity="success" icon={<CheckCircle />}
                            sx={{ mt: 2, backgroundColor: '#003320', color: '#86efac' }}>
                            <strong>Key decoded!</strong><br />
                            Algorithm: <strong>{decodedKey.algorithm}</strong>
                            {' | '}{algorithmDescriptions[decodedKey.algorithm]}
                            {decodedKey.rows != null && ` | Grid: ${decodedKey.rows}×${decodedKey.cols}`}
                            {decodedKey.noise?.intensity > 0 && ` | Noise: ${decodedKey.noise.intensity}`}
                            {decodedKey.creator?.username && ` | By: ${decodedKey.creator.username}`}
                        </Alert>
                    )} */}
                </CardContent>
            </Card>

            {/* ── Step 3: Unscramble ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>Step 3</Typography>
                        <Typography variant="h6">Unscramble Image</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                        <Button variant="contained"
                            onClick={confirmSpendingCredits}
                            startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <LockOpen />}
                            disabled={!imageLoaded || !decodedKey || isProcessing}
                            sx={{ backgroundColor: (!imageLoaded || !decodedKey || isProcessing) ? '#555' : '#22d3ee', color: '#001018', fontWeight: 'bold' }}>
                            {isProcessing ? 'Processing…' : 'Unscramble Image'}
                        </Button>
                        <Button variant="contained" startIcon={<Download />}
                            onClick={downloadFingerprintedImage} disabled={!fingerprintedUrl}
                            sx={{ backgroundColor: '#9c27b0', color: 'white' }}>
                            Download (Fingerprinted)
                        </Button>
                        {/* <Button variant="outlined" startIcon={<Download />}
                            onClick={downloadRawImage} disabled={!unscrambledUrl}
                            sx={{ color: '#ccc', borderColor: '#666' }}>
                            Download (Raw)
                        </Button> */}
                    </Box>

                    {(!imageLoaded || !decodedKey) && (
                        <Alert severity="warning" sx={{ mt: 1, mb: 2, backgroundColor: '#4a2000', color: '#fde68a' }}>
                            ⚠️ {!imageLoaded ? 'Select a scrambled image' : 'Load a valid key'} to continue
                        </Alert>
                    )}

                    {isProcessing && (
                        <Typography variant="body2" sx={{ color: '#aaa', mb: 2 }}>
                            Processing in browser — may take a few seconds for large images…
                        </Typography>
                    )}

                    {/* Results */}
                    {(unscrambledUrl || fingerprintedUrl) && (
                        <Grid container spacing={2} sx={{ mt: 2, borderTop: '1px solid #666', pt: 2 }}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>Scrambled (Input)</Typography>
                                <Box sx={{ minHeight: 200, backgroundColor: '#0b1020', border: '1px dashed #666', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {previewUrl
                                        ? <img src={previewUrl} alt="Scrambled" style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8 }} />
                                        : <Typography variant="body2" sx={{ color: '#666' }}>No image loaded</Typography>
                                    }
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>Unscrambled (Fingerprinted)</Typography>
                                <Box sx={{ minHeight: 200, backgroundColor: '#0b1020', border: '1px dashed #666', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {fingerprintedUrl
                                        ? <img src={fingerprintedUrl} alt="Unscrambled" style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8 }} />
                                        : <Typography variant="body2" sx={{ color: '#666' }}>Unscrambled image will appear here</Typography>
                                    }
                                </Box>
                            </Grid>
                        </Grid>
                    )}

                    {/* Fingerprint info */}
                    {/* {fingerprintParams && (
                        <Box sx={{ mt: 2, p: 2, backgroundColor: '#001830', border: '1px solid #0369a1', borderRadius: 2 }}>
                            <Typography variant="body2" sx={{ color: '#93c5fd', fontFamily: 'monospace' }}>
                                <strong>Fingerprint Applied:</strong><br />
                                Tracking #: {fingerprintParams.trackingNumber} | Angle: {fingerprintParams.angleDeg}° | Zoom: {fingerprintParams.zoom}x | Shift: ({fingerprintParams.shiftX}, {fingerprintParams.shiftY})
                            </Typography>
                        </Box>
                    )} */}
                </CardContent>
            </Card>

            {/* Modals */}
            <CreditConfirmationModal
                open={showCreditModal}
                onClose={() => setShowCreditModal(false)}
                onConfirm={handleCreditConfirm}
                mediaType="photo"
                scrambleLevel={scrambleLevel}
                currentCredits={userCredits}
                fileName={selectedFile?.name ?? ''}
                file={selectedFile}
                user={userData}
                fileDetails={{
                    type: 'image', size: selectedFile?.size ?? 0, name: selectedFile?.name ?? '',
                    horizontal: imageRef.current?.naturalWidth ?? 0,
                    vertical: imageRef.current?.naturalHeight ?? 0,
                }}
                actionType="unscramble-photo-standard"
            />
            <ProcessingModal open={isProcessing} mediaType="photo" />

            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mt: 2 }}>
                <Typography variant="body2" color="black">
                    💡 <strong>Client-Side Version:</strong> Unscrambling runs entirely in your browser.
                    Only keys from <em>PhotoScramblerStandardCS</em> (version "standard-cs") are accepted.
                    A fingerprint transform is applied to the output for tracking purposes.
                </Typography>
            </Paper>
        </Container>
    );
}
