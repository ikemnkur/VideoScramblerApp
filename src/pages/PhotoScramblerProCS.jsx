// PhotoScramblerProCS.jsx — Client-Side Pro Photo Scrambler
// HPF (frequency-domain) scrambling runs entirely in the browser.
// Key format: version 5 "hpf" — compatible with scramble_photo_pro.py

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Container, Typography, Card, CardContent, Button, TextField,
    Box, Grid, Chip, Alert, Slider, CircularProgress
} from '@mui/material';
import {
    PhotoCamera, Shuffle, Download, ContentCopy, AutoAwesome, Casino, Lock, LockOpen
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

// ─── Algorithm constants ────────────────────────────────────────────────────
const BLUR_KSIZE_DEFAULT = 31;
const WATERMARK_ROWS = 1; // empty tile rows top/bottom (reserved for watermarks)

/** Derive Gaussian sigma from kernel size — matches OpenCV's sigma=0 formula exactly. */
function blurSigmaFromKsize(k) { return 0.3 * ((k - 1) * 0.5 - 1) + 0.8; }

// ═══════════════════════════════════════════════════════
// PURE ALGORITHM FUNCTIONS  (no React, no side-effects)
// ═══════════════════════════════════════════════════════

function mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
        let t = (s += 0x6D2B79F5) >>> 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function genRandomSeed() {
    if (window.crypto?.getRandomValues) {
        const buf = new Uint32Array(1);
        window.crypto.getRandomValues(buf);
        return buf[0] >>> 0;
    }
    return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

function seededPermutation(size, seed) {
    const rnd = mulberry32(seed >>> 0);
    const arr = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function autoGridForAspect(w, h) {
    let bestN = 2, bestM = 2, bestScore = Infinity;
    for (let n = 2; n <= 10; n++) {
        for (let m = 2; m <= 10; m++) {
            const score = Math.abs((w / m) / (h / n) - 1.0);
            if (score < bestScore) { bestScore = score; bestN = n; bestM = m; }
        }
    }
    return { n: bestN, m: bestM };
}

function computeKLr(n, m) { return Math.max(1, Math.ceil(m / 2)); }

function getBorderPositions(n, m, kLr, kTb) {
    const pos = [];
    for (let r = kTb; r < kTb + n; r++)
        for (let c = 0; c < kLr; c++) pos.push([r, c]);
    for (let r = kTb; r < kTb + n; r++)
        for (let c = kLr + m; c < kLr + m + kLr; c++) pos.push([r, c]);
    return pos;
}

/** Separable Gaussian blur with replicate-edge padding (matches OpenCV BORDER_REPLICATE). */
function separableGaussianBlur(pixels, w, h, ksize, sigma) {
    const half = ksize >> 1;
    const kernel = new Float32Array(ksize);
    let ksum = 0;
    for (let i = 0; i < ksize; i++) {
        const x = i - half;
        kernel[i] = Math.exp(-x * x / (2 * sigma * sigma));
        ksum += kernel[i];
    }
    for (let i = 0; i < ksize; i++) kernel[i] /= ksum;

    // Horizontal pass → tmp (RGB only, Float32)
    const tmp = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const di = (y * w + x) * 3;
            for (let c = 0; c < 3; c++) {
                let v = 0;
                for (let k = 0; k < ksize; k++) {
                    const sx = Math.max(0, Math.min(w - 1, x + k - half));
                    v += pixels[(y * w + sx) * 4 + c] * kernel[k];
                }
                tmp[di + c] = v;
            }
        }
    }

    // Vertical pass → output Uint8ClampedArray (RGBA)
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const di = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
                let v = 0;
                for (let k = 0; k < ksize; k++) {
                    const sy = Math.max(0, Math.min(h - 1, y + k - half));
                    v += tmp[(sy * w + x) * 3 + c] * kernel[k];
                }
                out[di + c] = Math.round(v);
            }
            out[di + 3] = pixels[di + 3];
        }
    }
    return out;
}

/** Extract a rectangular region from a flat RGBA pixel buffer. */
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

/** Write a tile into a flat RGBA pixel buffer. */
function placeTile(pixels, imgW, x0, y0, tile, tileW, tileH) {
    for (let r = 0; r < tileH; r++)
        for (let c = 0; c < tileW; c++) {
            const si = (r * tileW + c) * 4;
            const di = ((y0 + r) * imgW + (x0 + c)) * 4;
            pixels[di] = tile[si]; pixels[di + 1] = tile[si + 1];
            pixels[di + 2] = tile[si + 2]; pixels[di + 3] = tile[si + 3];
        }
}

/**
 * Flip a tile buffer.
 * mode: 0=none, 1=horizontal mirror, 2=vertical mirror, 3=180° rotate
 */
function flipTileData(tile, tileW, tileH, mode) {
    if (mode === 0) return tile;
    const out = new Uint8ClampedArray(tile.length);
    for (let r = 0; r < tileH; r++)
        for (let c = 0; c < tileW; c++) {
            const sr = (mode & 2) ? (tileH - 1 - r) : r;
            const sc = (mode & 1) ? (tileW - 1 - c) : c;
            const si = (sr * tileW + sc) * 4;
            const di = (r * tileW + c) * 4;
            out[di] = tile[si]; out[di + 1] = tile[si + 1];
            out[di + 2] = tile[si + 2]; out[di + 3] = tile[si + 3];
        }
    return out;
}

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

function applyNoiseAddMod256(pixels, w, h, offsets, tileSize) {
    const out = new Uint8ClampedArray(pixels);
    for (let y = 0; y < h; y++) {
        const ty = y % tileSize;
        for (let x = 0; x < w; x++) {
            const ti = (ty * tileSize + (x % tileSize)) * 3;
            const pi = (y * w + x) * 4;
            out[pi]     = (pixels[pi]     + offsets[ti]     + 256) & 0xFF;
            out[pi + 1] = (pixels[pi + 1] + offsets[ti + 1] + 256) & 0xFF;
            out[pi + 2] = (pixels[pi + 2] + offsets[ti + 2] + 256) & 0xFF;
        }
    }
    return out;
}

/**
 * HPF-scramble an ImageData.
 * Returns { pixels, outW, outH, keyParams }
 */
function hpfScramble(imgData, n, m, seed, noiseIntensity, blurKsize) {
    const { data: src, width: origW, height: origH } = imgData;
    const tileW = Math.floor(origW / m);
    const tileH = Math.floor(origH / n);
    const cropW = m * tileW;
    const cropH = n * tileH;

    // Crop to tile-aligned region
    const cropped = new Uint8ClampedArray(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++)
        for (let x = 0; x < cropW; x++) {
            const si = (y * origW + x) * 4;
            const di = (y * cropW + x) * 4;
            cropped[di] = src[si]; cropped[di + 1] = src[si + 1];
            cropped[di + 2] = src[si + 2]; cropped[di + 3] = 255;
        }

    // Gaussian blur → LPF
    const ksize = blurKsize ?? BLUR_KSIZE_DEFAULT;
    const sigma = blurSigmaFromKsize(ksize);
    const lpf = separableGaussianBlur(cropped, cropW, cropH, ksize, sigma);

    // HPF = clamp(orig − LPF + 128, 0, 255)
    const hpf = new Uint8ClampedArray(cropW * cropH * 4);
    for (let i = 0; i < cropW * cropH; i++) {
        const b = i * 4;
        hpf[b]     = Math.max(0, Math.min(255, cropped[b]     - lpf[b]     + 128));
        hpf[b + 1] = Math.max(0, Math.min(255, cropped[b + 1] - lpf[b + 1] + 128));
        hpf[b + 2] = Math.max(0, Math.min(255, cropped[b + 2] - lpf[b + 2] + 128));
        hpf[b + 3] = 255;
    }

    // Extract n×m HPF tiles
    const N = n * m;
    const hpfTiles = [];
    for (let r = 0; r < n; r++)
        for (let c = 0; c < m; c++)
            hpfTiles.push(extractTile(hpf, cropW, c * tileW, r * tileH, tileW, tileH));

    const perm = seededPermutation(N, seed);
    const kLr = computeKLr(n, m);
    const kTb = WATERMARK_ROWS;
    const outW = (m + 2 * kLr) * tileW;
    const outH = (n + 2 * kTb) * tileH;
    const borderPos = getBorderPositions(n, m, kLr, kTb);

    // Build output canvas (black = watermark placeholder areas)
    const out = new Uint8ClampedArray(outW * outH * 4);
    for (let i = 3; i < out.length; i += 4) out[i] = 255;

    // LPF → center
    placeTile(out, outW, kLr * tileW, kTb * tileH, lpf, cropW, cropH);

    // Scrambled + flipped HPF tiles → borders
    for (let destIdx = 0; destIdx < N; destIdx++) {
        const srcIdx = perm[destIdx];
        const tile = flipTileData(hpfTiles[srcIdx], tileW, tileH, srcIdx % 4);
        const [br, bc] = borderPos[destIdx];
        placeTile(out, outW, bc * tileW, br * tileH, tile, tileW, tileH);
    }

    // Noise layer (after HPF scramble, same as Python server)
    let finalPixels = out;
    let noiseTileSize = null;
    if (noiseIntensity > 0) {
        noiseTileSize = Math.min(512, Math.max(64, Math.min(cropW, cropH) >> 2));
        const noiseOffsets = generateNoiseTileOffsets(noiseTileSize, seed + 999, noiseIntensity);
        finalPixels = applyNoiseAddMod256(out, outW, outH, noiseOffsets, noiseTileSize);
    }

    const keyParams = {
        version: 5,
        algorithm: 'hpf',
        seed,
        n,
        m,
        perm1based: perm.map(x => x + 1),
        blur_ksize: ksize,
        blur_sigma: parseFloat(sigma.toFixed(4)),
        border_cols_lr: kLr,
        watermark_rows_tb: kTb,
        tile_h: tileH,
        tile_w: tileW,
        orig_height: origH,
        orig_width: origW,
        semantics: 'HPF tiles scrambled on left/right borders, LPF in center, top/bottom empty for watermarks.',
        ...(noiseIntensity > 0 && { noise_intensity: noiseIntensity, noise_tile_size: noiseTileSize }),
    };

    return { pixels: finalPixels, outW, outH, keyParams };
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export default function PhotoScramblerProCS() {
    const { success, error, info } = useToast();

    // Refs
    const fileInputRef  = useRef(null);
    const imageRef      = useRef(null);
    const scrambleImageRef = useRef(null);

    // File state
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl]     = useState('');
    const [imageLoaded, setImageLoaded]   = useState(false);

    // Result state
    const [scrambledUrl, setScrambledUrl]     = useState('');
    const [keyCode, setKeyCode]               = useState('');
    const [keyLimitsActivated, setKeyLimitsActivated] = useState(true);
    const [keyUses, setKeyUses]               = useState(1000);
    const [keyExpiry, setKeyExpiry]           = useState(30);
    const [baseKeyObject, setBaseKeyObject]   = useState(null);

    // Settings
    const [seed, setSeed]               = useState(() => genRandomSeed());
    const [rows, setRows]               = useState(6);
    const [cols, setCols]               = useState(6);
    const [noiseIntensity, setNoiseIntensity] = useState(30);
    const [blurKsize, setBlurKsize]     = useState(BLUR_KSIZE_DEFAULT);
    const [autoGrid, setAutoGrid]       = useState(false);

    // Processing / credits
    const [isProcessing, setIsProcessing]     = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [allowScrambling, setAllowScrambling] = useState(false);
    const [actionCost, setActionCost]         = useState(15);
    const [scrambleLevel, setScrambleLevel]   = useState(1);
    const [userData]                           = useState(() => JSON.parse(localStorage.getItem('userdata')));
    const [userCredits, setUserCredits]       = useState(0);
    const [shuffleParams, setShuffleParams]   = useState(null);

    // ─── credit helpers ────────────────────────────────────────────────────
    useEffect(() => {
        if (!userData?.username) return;
        api.post(`/api/wallet/balance/${userData.username}`, { email: userData.email })
            .then(({ data }) => setUserCredits(data.balance ?? 0))
            .catch(() => {});
    }, [userData]);

    const getActualCost = () => {
        const stored = parseInt(localStorage.getItem('lastActionCost'));
        return stored === actionCost ? stored : actionCost;
    };

    const handleRefundCredits = async (cost) => {
        await refundCredits({
            userId: userData.id, username: userData.username, email: userData.email,
            credits: getActualCost(), currentCredits: userCredits,
            password: localStorage.getItem('hashedPassword'),
            action: 'scramble-photo-pro-cs',
            params: { scrambleLevel, grid: { rows, cols }, seed, noise: { intensity: noiseIntensity }, type: 'photo', version: 'premium-cs' }
        }).catch(() => {});
        error('Scrambling failed. Any credits spent have been refunded.');
    };

    const confirmSpendingCredits = () => {
        setScrambleLevel(Math.max(cols, rows));
        setShowCreditModal(true);
    };

    const handleCreditConfirm = useCallback((actualCostSpent) => {
        setShowCreditModal(false);
        setAllowScrambling(true);
        setShuffleParams({ version: 5, algorithm: 'hpf', seed, n: rows, m: cols });
        setActionCost(actualCostSpent);
        setTimeout(() => { scrambleImageRef.current(actualCostSpent); }, 0);
    }, [selectedFile, allowScrambling, seed, rows, cols]);

    // ─── file handling ────────────────────────────────────────────────────
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { error('Please select an image file'); return; }

        setSelectedFile(file);
        setScrambledUrl('');
        setKeyCode('');
        setImageLoaded(false);

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        const img = imageRef.current;
        if (img) {
            img.onload = () => {
                setImageLoaded(true);
                if (autoGrid) {
                    const g = autoGridForAspect(img.naturalWidth, img.naturalHeight);
                    setRows(g.n); setCols(g.m);
                }
                URL.revokeObjectURL(url);
            };
            img.onerror = () => { error('Failed to load image'); URL.revokeObjectURL(url); };
            img.src = url;
        }
    };

    // ─── main scramble function ───────────────────────────────────────────
    const scrambleImage = useCallback(async (cost) => {
        if (!selectedFile || !imageRef.current?.naturalWidth) {
            error('Please select an image first'); return;
        }
        setIsProcessing(true);
        // Yield to let React render the Processing state
        await new Promise(r => setTimeout(r, 50));

        try {
            const img = imageRef.current;
            const w = img.naturalWidth, h = img.naturalHeight;

            // Draw image to canvas to get ImageData
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, h);

            const n = rows, m = cols;
            const { pixels, outW, outH, keyParams } = hpfScramble(imgData, n, m, seed, noiseIntensity, blurKsize);

            // Render result to canvas → data URL
            const outCanvas = document.createElement('canvas');
            outCanvas.width = outW; outCanvas.height = outH;
            const outCtx = outCanvas.getContext('2d');
            outCtx.putImageData(new ImageData(pixels, outW, outH), 0, 0);
            const dataUrl = outCanvas.toDataURL('image/png');
            setScrambledUrl(dataUrl);

            // Build key
            const keyId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const fullKey = {
                ...keyParams,
                key_id: keyId,
                timestamp: Date.now(),
                creator: { username: userData?.username ?? 'Anonymous', userId: userData?.id ?? 'Unknown', timestamp: new Date().toISOString() },
                metadata: { filename: selectedFile.name, size: selectedFile.size, dimensions: { width: w, height: h } },
                limits: {
                    activated: keyLimitsActivated,
                    max_uses: keyLimitsActivated ? keyUses : null,
                    expires_at: keyLimitsActivated && keyExpiry
                        ? new Date(Date.now() + keyExpiry * 86400000).toISOString() : null
                },
            };
            setBaseKeyObject(fullKey);
            setKeyCode(btoa(JSON.stringify(fullKey)));

            // Register key with server (non-blocking)
            api.post(`${API_URL}/api/keys/register`, {
                key_id: keyId, media_type: 'photo', algorithm: 'hpf',
                max_uses: keyLimitsActivated ? keyUses : null,
                expires_at: fullKey.limits.expires_at
            }).catch(err => console.warn('Key registration failed:', err.message));

            // Analytics (non-blocking)
            api.post('/api/analytics/scramble-event', {
                username: userData?.username, userId: userData?.id,
                scrambleType: 'photo', scrambleLevel: Math.max(n, m),
                timestamp: new Date().toISOString(), actionCost: cost,
                mediaDetails: { name: selectedFile.name, size: selectedFile.size, width: w, height: h },
            }).catch(() => {});

            success('Image scrambled successfully!');
            setTimeout(() => info(`Scrambled. ${cost} credits spent.`), 1500);
        } catch (err) {
            console.error('Scramble error:', err);
            error('Scrambling failed: ' + err.message);
            handleRefundCredits(cost);
        } finally {
            setIsProcessing(false);
            setAllowScrambling(false);
        }
    }, [selectedFile, seed, rows, cols, noiseIntensity, blurKsize, userData, keyLimitsActivated, keyUses, keyExpiry]);

    scrambleImageRef.current = scrambleImage;

    // ─── key management ──────────────────────────────────────────────────
    const copyKey = async () => {
        if (!keyCode) { error('Scramble an image first'); return; }
        await navigator.clipboard.writeText(keyCode).then(() => success('Key copied!')).catch(() => error('Copy failed'));
    };

    const downloadKey = () => {
        if (!keyCode) { error('Scramble an image first'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([keyCode], { type: 'text/plain' }));
        a.download = `unscramble_key_${selectedFile?.name ?? 'photo'}_${Date.now()}.txt`;
        a.click();
        success('Key downloaded!');
    };

    const downloadScrambled = () => {
        if (!scrambledUrl) { error('Scramble an image first'); return; }
        const a = document.createElement('a');
        a.href = scrambledUrl;
        a.download = `scrambled_${selectedFile?.name?.replace(/\.[^/.]+$/, '') ?? 'photo'}_${Date.now()}.png`;
        a.click();
        success('Scrambled image downloaded!');
    };

    // ─── key limits re-encode ─────────────────────────────────────────────
    useEffect(() => {
        if (!baseKeyObject) return;
        const expiresAt = keyLimitsActivated && keyExpiry
            ? new Date(Date.now() + keyExpiry * 86400000).toISOString() : null;
        const updated = { ...baseKeyObject, limits: { activated: keyLimitsActivated, max_uses: keyLimitsActivated ? keyUses : null, expires_at: expiresAt } };
        setKeyCode(btoa(JSON.stringify(updated)));
    }, [baseKeyObject, keyLimitsActivated, keyUses, keyExpiry]);

    // ─── render ───────────────────────────────────────────────────────────
    return (
        <Container sx={{ py: 4 }}>
            {/* Hidden image for pixel access */}
            <img ref={imageRef} style={{ display: 'none' }} alt="" crossOrigin="anonymous" />

            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ mb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <AutoAwesome /> 🚀 Photo Scrambler Pro
                </Typography>
                {/* I have to dumb things down for the production/deployment so im hiding technical detial that everyday users dont need to know about. This is the client-side version of the HPF scrambling algorithm used in scramble_photo_pro.py. It runs entirely in the browser, so no image data is uploaded to any server. The generated key is compatible with the server-side version, so you can share scrambled images and keys between them as needed. */}
                {/* <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Client-side HPF frequency-domain scrambling — no upload required
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="Client-Side" size="small" color="success" />
                    <Chip label="HPF Algorithm" size="small" color="primary" />
                    <Chip label="PNG/JPG" size="small" />
                    <Chip label="Server Compatible Keys" size="small" color="info" />
                </Box> */}
            </Box>

            {/* ── Upload ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhotoCamera /> Select Image
                    </Typography>
                    <input type="file" accept="image/*" onChange={handleFileSelect}
                        style={{ display: 'none' }} id="cs-scramble-input" ref={fileInputRef} />
                    <label htmlFor="cs-scramble-input">
                        <Button variant="contained" component="span" startIcon={<PhotoCamera />}
                            sx={{ backgroundColor: '#2196f3' }}>
                            Choose Image
                        </Button>
                    </label>
                    {selectedFile && (
                        <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                            {imageRef.current?.naturalWidth ? ` — ${imageRef.current.naturalWidth}×${imageRef.current.naturalHeight}px` : ''}
                        </Typography>
                    )}
                    {previewUrl && (
                        <Box sx={{ mt: 2 }}>
                            <img src={previewUrl} alt="Preview"
                                style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, border: '1px solid #666' }} />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ── Settings ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Shuffle /> Scramble Settings
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={5}>
                            <TextField fullWidth type="number" label="Seed" value={seed}
                                onChange={e => setSeed(parseInt(e.target.value) || 0)}
                                InputProps={{
                                    sx: { backgroundColor: '#353535', color: 'white' },
                                    endAdornment: (
                                        <Button size="small" onClick={() => setSeed(genRandomSeed())}
                                            startIcon={<Casino />} sx={{ color: '#22d3ee', minWidth: 'auto' }}>
                                            Random
                                        </Button>
                                    )
                                }}
                                InputLabelProps={{ sx: { color: '#ccc' } }} />
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <TextField fullWidth type="number" label="Rows" value={rows}
                                onChange={e => setRows(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
                                inputProps={{ min: 2, max: 20 }}
                                InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                InputLabelProps={{ sx: { color: '#ccc' } }} />
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <TextField fullWidth type="number" label="Cols" value={cols}
                                onChange={e => setCols(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
                                inputProps={{ min: 2, max: 20 }}
                                InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                InputLabelProps={{ sx: { color: '#ccc' } }} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Button variant="outlined" fullWidth onClick={() => {
                                if (imageRef.current?.naturalWidth) {
                                    const g = autoGridForAspect(imageRef.current.naturalWidth, imageRef.current.naturalHeight);
                                    setRows(g.n); setCols(g.m);
                                    info(`Auto grid: ${g.n}×${g.m}`);
                                } else { error('Load an image first'); }
                            }} sx={{ height: '56px', color: '#22d3ee', borderColor: '#22d3ee' }}>
                                Auto Grid
                            </Button>
                        </Grid>

                        <Grid item xs={12}>
                            <Typography variant="body1" sx={{ color: '#e0e0e0', mb: 1 }}>
                                Blur Amount (ksize): {blurKsize}
                                <Typography component="span" variant="caption" sx={{ ml: 1, color: '#aaa' }}>
                                    (σ = {blurSigmaFromKsize(blurKsize).toFixed(2)} — higher = stronger LPF/HPF split)
                                </Typography>
                            </Typography>
                            <Slider value={blurKsize} onChange={(_, v) => setBlurKsize(v)}
                                min={15} max={75} step={2}
                                marks={[{value:15,label:'15 (default)'},{value:31,label:'31'},{value:51,label:'51'},{value:75,label:'75'}]}
                                sx={{ color: '#7c3aed' }} />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="body1" sx={{ color: '#e0e0e0', mb: 1 }}>
                                Noise Intensity: {noiseIntensity}
                                <Typography component="span" variant="caption" sx={{ ml: 1, color: '#aaa' }}>
                                    (0 = off, adds pixel-level encryption layer)
                                </Typography>
                            </Typography>
                            <Slider value={noiseIntensity} onChange={(_, v) => setNoiseIntensity(v)}
                                min={0} max={80} step={5}
                                marks={[{value:0,label:'Off'},{value:20,label:'20'},{value:40,label:'40'},{value:60,label:'60'},{value:80,label:'80'}]}
                                sx={{ color: '#22d3ee' }} />
                        </Grid>
                    </Grid>

                    {/* <Alert severity="info" sx={{ mt: 2, backgroundColor: '#1a3a4a', color: '#7dd3fc' }}>
                        Grid <strong>{rows}×{cols}</strong> → {rows * cols} tiles.
                        Output will be <strong>{cols + 2 * computeKLr(rows, cols)}×{rows + 2 * WATERMARK_ROWS}</strong> tiles wide/tall
                        (slightly larger than input to store HPF border data).
                        Blur: ksize <strong>{blurKsize}</strong>, σ <strong>{blurSigmaFromKsize(blurKsize).toFixed(2)}</strong>.
                    </Alert> */}
                </CardContent>
            </Card>

            {/* ── Scramble button ── */}
            <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <Shuffle />}
                    onClick={confirmSpendingCredits}
                    disabled={!imageLoaded || isProcessing}
                    sx={{ backgroundColor: '#7c3aed', px: 5, py: 1.5, fontSize: '1.1rem' }}>
                    {isProcessing ? 'Scrambling…' : 'Scramble Image'}
                </Button>
                {isProcessing && (
                    <Typography variant="body2" sx={{ color: '#aaa', mt: 1 }}>
                        Processing in browser — this may take a few seconds for large images…
                    </Typography>
                )}
            </Box>

            {/* ── Result ── */}
            {scrambledUrl && (
                <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h5" sx={{ mb: 2 }}>✅ Scrambled Result</Typography>
                        <Box sx={{ mb: 2 }}>
                            <img src={scrambledUrl} alt="Scrambled"
                                style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8, border: '1px solid #666' }} />
                        </Box>
                        <Button variant="contained" startIcon={<Download />} onClick={downloadScrambled}
                            sx={{ backgroundColor: '#16a34a', mr: 2 }}>
                            Download Scrambled Image
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Key Management ── */}
            {keyCode && (
                <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Lock /> Unscramble Key
                        </Typography>
                        <Alert severity="warning" sx={{ mb: 2, backgroundColor: '#4a3000', color: '#fde68a' }}>
                            Keep this key safe — it is the only way to unscramble your image.
                        </Alert>

                        <TextField fullWidth multiline rows={3} value={keyCode} readOnly
                            InputProps={{ sx: { backgroundColor: '#252525', color: '#a5f3fc', fontFamily: 'monospace', fontSize: '0.7rem' } }}
                            sx={{ mb: 2 }} />

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                            <Button variant="outlined" startIcon={<ContentCopy />} onClick={copyKey}
                                sx={{ color: '#22d3ee', borderColor: '#22d3ee' }}>Copy Key</Button>
                            <Button variant="contained" startIcon={<Download />} onClick={downloadKey}
                                sx={{ backgroundColor: '#0369a1' }}>Download Key</Button>
                        </Box>

                        {/* Key limits */}
                        <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>Key Limits</Typography>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <Button
                                    variant={keyLimitsActivated ? 'contained' : 'outlined'}
                                    onClick={() => setKeyLimitsActivated(v => !v)}
                                    startIcon={keyLimitsActivated ? <Lock /> : <LockOpen />}
                                    sx={{ width: '100%' }}>
                                    {keyLimitsActivated ? 'Limits ON' : 'Limits OFF'}
                                </Button>
                            </Grid>
                            {keyLimitsActivated && <>
                                <Grid item xs={6} md={4}>
                                    <TextField fullWidth type="number" label="Max Uses" value={keyUses}
                                        onChange={e => setKeyUses(Math.max(1, parseInt(e.target.value) || 1))}
                                        InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                        InputLabelProps={{ sx: { color: '#ccc' } }} />
                                </Grid>
                                <Grid item xs={6} md={4}>
                                    <TextField fullWidth type="number" label="Expires (days)" value={keyExpiry}
                                        onChange={e => setKeyExpiry(Math.max(1, parseInt(e.target.value) || 1))}
                                        InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                        InputLabelProps={{ sx: { color: '#ccc' } }} />
                                </Grid>
                            </>}
                        </Grid>
                    </CardContent>
                </Card>
            )}

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
            />
            <ProcessingModal open={isProcessing} />
        </Container>
    );
}
