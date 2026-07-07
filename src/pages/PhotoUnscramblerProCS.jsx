// PhotoUnscramblerProCS.jsx — Client-Side Pro Photo Unscrambler
// HPF (frequency-domain) unscrambling runs entirely in the browser.
// Key format: version 5 "hpf" — compatible with scramble_photo_pro.py and PhotoScramblerProCS

import React, { useState, useRef, useCallback } from 'react';
import {
    Container, Typography, Card, CardContent, Button, TextField,
    Box, Grid, Chip, Alert, CircularProgress, Divider
} from '@mui/material';
import {
    PhotoCamera, LockOpen, Download, VpnKey, Upload, AutoAwesome, CheckCircle
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

// ═══════════════════════════════════════════════════════
// FINGERPRINT TRANSFORM UTILITIES
// (copied from PhotoUnscramblerPro.jsx — same algorithm)
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
    const zoom = 1.05 + rnd() * 0.05;
    const shiftX = (rnd() * 2 - 1) * 12;
    const shiftY = (rnd() * 2 - 1) * 12;
    const cropTop = 16 + Math.floor(rnd() * 16);
    const cropRight = 16 + Math.floor(rnd() * 16);
    const cropBottom = 16 + Math.floor(rnd() * 16);
    const cropLeft = 16 + Math.floor(rnd() * 16);
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
    const ang = applyInverse ? -params.angle : params.angle;
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
                angleDeg: params.angleDeg.toFixed(2),
                zoom: params.zoom.toFixed(3),
                shiftX: params.shiftX.toFixed(1),
                shiftY: params.shiftY.toFixed(1),
            }
        };
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

// ═══════════════════════════════════════════════════════
// HPF UNSCRAMBLE ALGORITHM (pure functions)
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

function computeKLr(n, m) { return Math.max(1, Math.ceil(m / 2)); }

function getBorderPositions(n, m, kLr, kTb) {
    const pos = [];
    for (let r = kTb; r < kTb + n; r++)
        for (let c = 0; c < kLr; c++) pos.push([r, c]);
    for (let r = kTb; r < kTb + n; r++)
        for (let c = kLr + m; c < kLr + m + kLr; c++) pos.push([r, c]);
    return pos;
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
        offsets[b] = Math.round((rnd() * 2 - 1) * intensity);
        offsets[b + 1] = Math.round((rnd() * 2 - 1) * intensity);
        offsets[b + 2] = Math.round((rnd() * 2 - 1) * intensity);
    }
    return offsets;
}

function applyNoiseSubMod256(pixels, w, h, offsets, tileSize) {
    const out = new Uint8ClampedArray(pixels);
    for (let y = 0; y < h; y++) {
        const ty = y % tileSize;
        for (let x = 0; x < w; x++) {
            const ti = (ty * tileSize + (x % tileSize)) * 3;
            const pi = (y * w + x) * 4;
            out[pi] = (pixels[pi] - offsets[ti] + 256) & 0xFF;
            out[pi + 1] = (pixels[pi + 1] - offsets[ti + 1] + 256) & 0xFF;
            out[pi + 2] = (pixels[pi + 2] - offsets[ti + 2] + 256) & 0xFF;
        }
    }
    return out;
}

/**
 * HPF unscramble an ImageData using the provided key object.
 * Returns { pixels, w, h } — the reconstructed image.
 */
function hpfUnscramble(imgData, keyObj) {
    const {
        n, m, perm1based, seed,
        tile_h: tileH, tile_w: tileW,
        border_cols_lr: kLr, watermark_rows_tb: kTb,
        noise_intensity: noiseIntensity = 0,
        noise_tile_size: noiseTileSize,
    } = keyObj;

    const perm = perm1based.map(x => x - 1);
    const N = n * m;
    const { data: src, width: scW, height: scH } = imgData;
    const borderPos = getBorderPositions(n, m, kLr, kTb);

    // Step 1: remove noise layer (reverse of scramble's last step)
    let pixels = new Uint8ClampedArray(src);
    if (noiseIntensity > 0 && noiseTileSize) {
        const noiseOffsets = generateNoiseTileOffsets(noiseTileSize, seed + 999, noiseIntensity);
        pixels = applyNoiseSubMod256(pixels, scW, scH, noiseOffsets, noiseTileSize);
    }

    // Step 2: extract LPF from center region
    const lpfW = m * tileW, lpfH = n * tileH;
    const lpfX = kLr * tileW, lpfY = kTb * tileH;
    const lpf = extractTile(pixels, scW, lpfX, lpfY, lpfW, lpfH);

    // Step 3: extract border HPF tiles, undo flip, place in correct source position
    const hpfTiles = new Array(N).fill(null);
    for (let destIdx = 0; destIdx < Math.min(N, borderPos.length); destIdx++) {
        const srcIdx = perm[destIdx];
        if (srcIdx < 0 || srcIdx >= N) continue;
        const [br, bc] = borderPos[destIdx];
        let tile = extractTile(pixels, scW, bc * tileW, br * tileH, tileW, tileH);
        // Flip is self-inverse — same mode undoes itself
        tile = flipTileData(tile, tileW, tileH, srcIdx % 4);
        hpfTiles[srcIdx] = tile;
    }

    // Step 4: reassemble HPF canvas (neutral grey = 128 for missing tiles)
    const hpf = new Uint8ClampedArray(lpfW * lpfH * 4);
    for (let p = 0; p < lpfW * lpfH; p++) {
        hpf[p * 4] = 128; hpf[p * 4 + 1] = 128; hpf[p * 4 + 2] = 128; hpf[p * 4 + 3] = 255;
    }
    for (let idx = 0; idx < N; idx++) {
        if (!hpfTiles[idx]) continue;
        const r = Math.floor(idx / m), c = idx % m;
        placeTile(hpf, lpfW, c * tileW, r * tileH, hpfTiles[idx], tileW, tileH);
    }

    // Step 5: reconstruct original = clamp(LPF + HPF − 128, 0, 255)
    const recon = new Uint8ClampedArray(lpfW * lpfH * 4);
    for (let p = 0; p < lpfW * lpfH; p++) {
        const b = p * 4;
        recon[b] = Math.max(0, Math.min(255, lpf[b] + hpf[b] - 128));
        recon[b + 1] = Math.max(0, Math.min(255, lpf[b + 1] + hpf[b + 1] - 128));
        recon[b + 2] = Math.max(0, Math.min(255, lpf[b + 2] + hpf[b + 2] - 128));
        recon[b + 3] = 255;
    }

    return { pixels: recon, w: lpfW, h: lpfH };
}

/** Parse and validate a v5 HPF key from base64 string. Returns key object or throws. */
function decodeKey(keyString) {
    const trimmed = keyString.trim();
    let obj;
    try {
        obj = JSON.parse(atob(trimmed));
    } catch {
        try {
            obj = JSON.parse(trimmed);
        } catch {
            throw new Error('Key is not valid JSON or base64-encoded JSON.');
        }
    }
    if (!obj || typeof obj !== 'object') throw new Error('Key must be a JSON object.');
    if (obj.version !== 5) throw new Error(`Unsupported key version: ${obj.version}. Expected 5.`);
    if (obj.algorithm !== 'hpf') throw new Error(`Unsupported algorithm: "${obj.algorithm}". Expected "hpf".`);
    if (!Array.isArray(obj.perm1based) || !obj.n || !obj.m) throw new Error('Key is missing required fields (perm1based, n, m).');
    if (!obj.tile_h || !obj.tile_w) throw new Error('Key is missing tile dimensions (tile_h, tile_w).');
    if (!Number.isInteger(obj.border_cols_lr) || !Number.isInteger(obj.watermark_rows_tb))
        throw new Error('Key is missing border layout fields.');
    return obj;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export default function PhotoUnscramblerProCS() {
    const { success, error, info } = useToast();

    // Refs
    const fileInputRef = useRef(null);
    const keyFileInputRef = useRef(null);
    const imageRef = useRef(null);
    const unscrambleImageRef = useRef(null);

    // File state
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [imageLoaded, setImageLoaded] = useState(false);

    // Key state
    const [keyText, setKeyText] = useState('');
    const [keyObj, setKeyObj] = useState(null);
    const [keyError, setKeyError] = useState('');
    const [keyValid, setKeyValid] = useState(false);

    // Result state
    const [unscrambledUrl, setUnscrambledUrl] = useState('');
    const [fingerprintedUrl, setFingerprintedUrl] = useState('');
    const [fingerprintParams, setFingerprintParams] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState('');

    // Processing / credits
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [allowUnscrambling, setAllowUnscrambling] = useState(false);
    const [actionCost, setActionCost] = useState(15);
    const [scrambleLevel, setScrambleLevel] = useState(1);
    const [userData] = useState(() => JSON.parse(localStorage.getItem('userdata') || 'null'));
    const [userCredits, setUserCredits] = useState(0);

    // Generate a random ID for the watermark (for analytics purposes) when the component mounts
    const [watermark_idNumber, setWatermark_idNumber] = useState(Math.ceil(2 ** 16 * Math.random())); // Random ID for watermark (for analytics)

    // ─── credit helpers ────────────────────────────────────────────────────
    const getActualCost = () => {
        const stored = parseInt(localStorage.getItem('lastActionCost'));
        return stored === actionCost ? stored : actionCost;
    };

    const handleRefundCredits = async (cost) => {
        await refundCredits({
            userId: userData?.id, username: userData?.username, email: userData?.email,
            credits: getActualCost(), currentCredits: userCredits,
            password: localStorage.getItem('hashedPassword'),
            action: 'unscramble-photo-pro-cs',
        }).catch(() => { });
        error('Unscrambling failed. Any credits spent have been refunded.');
    };

    const confirmSpendingCredits = () => {
        if (!selectedFile || !imageLoaded) { error('Please select a scrambled image first'); return; }
        if (!keyValid || !keyObj) { error('Please enter a valid unscramble key'); return; }
        setScrambleLevel(Math.max(keyObj.n ?? 6, keyObj.m ?? 6));
        setShowCreditModal(true);
    };

    const handleCreditConfirm = useCallback((actualCostSpent) => {
        setShowCreditModal(false);
        setAllowUnscrambling(true);
        setActionCost(actualCostSpent);
        setTimeout(() => { unscrambleImageRef.current(actualCostSpent); }, 0);
    }, []);

    // ─── file handling ────────────────────────────────────────────────────
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
            img.onload = () => { setImageLoaded(true); URL.revokeObjectURL(url); };
            img.onerror = () => { error('Failed to load image'); URL.revokeObjectURL(url); };
            img.src = url;
        }
    };

    // ─── key handling ─────────────────────────────────────────────────────
    const handleKeyTextChange = (e) => {
        const text = e.target.value;
        setKeyText(text);
        setKeyError('');
        setKeyValid(false);
        setKeyObj(null);
        if (!text.trim()) return;
        try {
            const parsed = decodeKey(text);
            setKeyObj(parsed);
            setKeyValid(true);
        } catch (err) {
            setKeyError(err.message);
        }
    };

    const handleKeyFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            setKeyText(text);
            setKeyError('');
            setKeyValid(false);
            setKeyObj(null);
            try {
                const parsed = decodeKey(text);
                setKeyObj(parsed);
                setKeyValid(true);
                success('Key loaded from file!');
            } catch (err) {
                setKeyError(err.message);
                error('Invalid key file: ' + err.message);
            }
        };
        reader.onerror = () => error('Failed to read key file');
        reader.readAsText(file);
    };

    // ─── main unscramble function ─────────────────────────────────────────
    const unscrambleImage = useCallback(async (cost) => {
        if (!selectedFile || !imageRef.current?.naturalWidth) {
            error('Please select a scrambled image first'); return;
        }
        if (!keyObj) {
            error('Please enter a valid unscramble key'); return;
        }

        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 50)); // yield to let React render

        try {
            const img = imageRef.current;
            const w = img.naturalWidth, h = img.naturalHeight;

            // Get ImageData from scrambled image
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, h);

            // Run HPF unscramble
            const { pixels: reconPixels, w: reconW, h: reconH } = hpfUnscramble(imgData, keyObj);

            // Render to canvas → blob
            const outCanvas = document.createElement('canvas');
            outCanvas.width = reconW; outCanvas.height = reconH;
            const outCtx = outCanvas.getContext('2d');
            outCtx.putImageData(new ImageData(reconPixels, reconW, reconH), 0, 0);

            // Get blob for fingerprint application
            const reconBlob = await new Promise((res, rej) =>
                outCanvas.toBlob(b => b ? res(b) : rej(new Error('Canvas to blob failed')), 'image/png'));

            const rawUrl = URL.createObjectURL(reconBlob);
            setUnscrambledUrl(rawUrl);
            setDownloadUrl(rawUrl);

            // Apply fingerprint transform
            let fpParams = null;
            if (userData?.id) {
                try {
                    const fpResult = await applyFingerprintTransform(reconBlob, String(userData.id));
                    setFingerprintedUrl(fpResult.dataUrl);
                    setFingerprintParams(fpResult.params);
                    setDownloadUrl(fpResult.dataUrl);
                    fpParams = fpResult.params;
                } catch (fpErr) {
                    console.warn('Fingerprint failed:', fpErr);
                    // Non-fatal — just use raw image
                }
            }

            // Analytics
            api.post('/api/analytics/unscramble-event', {
                unscrambleKey: keyObj ? JSON.stringify(keyObj) : null,
                username: userData?.username, userId: userData?.id,
                unscrambleType: 'photo-pro-cs', scrambleLevel,
                timestamp: new Date().toISOString(), actionCost: cost,
                mediaDetails: { name: selectedFile.name, size: selectedFile.size, width: w, height: h },
                scrambleType: "unscramble-photo-pro-cs",
                watermarkParams: {
                    watermark_idNumber: watermark_idNumber,
                    // fingerprintParams: fingerprintParams
                },
                fingerprint: {
                    trackingNumber: fpParams?.trackingNumber || 'unknown',
                    angleDeg: fpParams?.angleDeg || 'unknown',
                    zoom: fpParams?.zoom || 'unknown',
                    shiftX: fpParams?.shiftX || 'unknown',
                    shiftY: fpParams?.shiftY || 'unknown'
                }
            }).catch(() => { });

            success('Image unscrambled successfully!');
            if (fpParams) {
                setTimeout(() => info(`Tracking ID: ${fpParams.trackingNumber}`), 1500);
            }
        } catch (err) {
            console.error('Unscramble error:', err);
            error('Unscrambling failed: ' + err.message);
            handleRefundCredits(cost);
        } finally {
            setIsProcessing(false);
            setAllowUnscrambling(false);
        }
    }, [selectedFile, keyObj, userData, scrambleLevel]);

    unscrambleImageRef.current = unscrambleImage;

    // ─── download helper ──────────────────────────────────────────────────
    const handleDownload = () => {
        if (!downloadUrl) { error('Unscramble an image first'); return; }
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `unscrambled_${selectedFile?.name?.replace(/\.[^/.]+$/, '') ?? 'photo'}_${Date.now()}.png`;
        a.click();
        success('Image downloaded!');
    };

    // ─── render ───────────────────────────────────────────────────────────
    return (
        <Container sx={{ py: 4 }}>
            {/* Hidden image for pixel access */}
            <img ref={imageRef} style={{ display: 'none' }} alt="" crossOrigin="anonymous" />

            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ mb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <LockOpen /> 🔓 Photo Unscrambler Pro
                </Typography>
                {/* I have to dumb things down for the production/deployment so im hiding technical detial that everyday users dont need to know about. This is the client-side version of the HPF scrambling algorithm used in scramble_photo_pro.py. It runs entirely in the browser, so no image data is uploaded to any server. The generated key is compatible with the server-side version, so you can share scrambled images and keys between them as needed. */}
                {/* <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Client-side HPF reconstruction — restores original image locally
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="Client-Side" size="small" color="success" />
                    <Chip label="HPF Algorithm" size="small" color="primary" />
                    <Chip label="Fingerprint Embed" size="small" color="warning" />
                    <Chip label="Server Compatible" size="small" color="info" />
                </Box> */}
            </Box>

            {/* ── Upload scrambled image ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhotoCamera /> Select Scrambled Image
                    </Typography>
                    <input type="file" accept="image/*" onChange={handleFileSelect}
                        style={{ display: 'none' }} id="cs-unscramble-input" ref={fileInputRef} />
                    <label htmlFor="cs-unscramble-input">
                        <Button variant="contained" component="span" startIcon={<PhotoCamera />}
                            sx={{ backgroundColor: '#2196f3' }}>
                            Choose Scrambled Image
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
                            <img src={previewUrl} alt="Scrambled preview"
                                style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, border: '1px solid #666' }} />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ── Key Input ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VpnKey /> Unscramble Key
                    </Typography>
                    <TextField
                        fullWidth multiline rows={4}
                        label="Paste your unscramble key here"
                        placeholder="Paste the base64-encoded key string or the raw JSON key..."
                        value={keyText}
                        onChange={handleKeyTextChange}
                        error={!!keyError}
                        // helperText={keyError || (keyValid ? '✅ Valid HPF v5 key' : '')}
                        helperText={keyError || (keyValid ? '✅ Valid Pro Scramble key' : '')}
                        InputProps={{ sx: { backgroundColor: '#353535', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' } }}
                        InputLabelProps={{ sx: { color: '#ccc' } }}
                        FormHelperTextProps={{ sx: { color: keyError ? '#f87171' : '#4ade80' } }}
                        sx={{ mb: 2 }}
                    />

                    <input type="file" accept=".txt,.json" onChange={handleKeyFileSelect}
                        style={{ display: 'none' }} id="cs-key-file-input" ref={keyFileInputRef} />
                    <label htmlFor="cs-key-file-input">
                        <Button variant="outlined" component="span" startIcon={<Upload />}
                            sx={{ color: '#22d3ee', borderColor: '#22d3ee' }}>
                            Load Key from File
                        </Button>
                    </label>
                    {/* Simplfying the UI for dummies */}
                    {/* {keyValid && keyObj && (
                        <Alert severity="success" sx={{ mt: 2, backgroundColor: '#14532d', color: '#86efac' }}>
                            <strong>Key details:</strong> Grid {keyObj.n}×{keyObj.m} — {keyObj.n * keyObj.m} tiles
                            {keyObj.noise_intensity ? ` — Noise: ${keyObj.noise_intensity}` : ''}
                            {keyObj.creator?.username ? ` — Created by: ${keyObj.creator.username}` : ''}
                        </Alert>
                    )} */}
                </CardContent>
            </Card>

            {/* ── Unscramble button ── */}
            <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <LockOpen />}
                    onClick={confirmSpendingCredits}
                    disabled={!imageLoaded || !keyValid || isProcessing}
                    sx={{ backgroundColor: '#7c3aed', px: 5, py: 1.5, fontSize: '1.1rem' }}>
                    {isProcessing ? 'Unscrambling…' : 'Unscramble Image'}
                </Button>
                {/* {isProcessing && (
                    <Typography variant="body2" sx={{ color: '#aaa', mt: 1 }}>
                        Reconstructing in browser — this may take a few seconds for large images…
                    </Typography>
                )} */}
            </Box>

            {/* ── Result ── */}
            {unscrambledUrl && (
                <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircle sx={{ color: '#4ade80' }} /> Unscrambled Result
                        </Typography>

                        {/* Show fingerprinted version if available */}
                        <Box sx={{ mb: 2 }}>
                            <img
                                src={fingerprintedUrl || unscrambledUrl}
                                alt="Unscrambled"
                                style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid #666' }}
                            />
                        </Box>

                        {/* Fingerprint info */}
                        {/* hidding the detials that every users wont understand */}
                        {/* {fingerprintParams && (
                            <Alert severity="info" sx={{ mb: 2, backgroundColor: '#1a3a4a', color: '#7dd3fc' }}>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    <strong>Fingerprint applied to this copy:</strong>
                                </Typography>
                                <Grid container spacing={1}>
                                    <Grid item xs={6} sm={3}>
                                        Tracking ID: <strong>{fingerprintParams.trackingNumber}</strong>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        Rotation: <strong>{fingerprintParams.angleDeg}°</strong>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        Zoom: <strong>{fingerprintParams.zoom}×</strong>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        Shift: <strong>({fingerprintParams.shiftX}, {fingerprintParams.shiftY})px</strong>
                                    </Grid>
                                </Grid>
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                                    Each user's copy has a unique subtle transform for leak tracing.
                                </Typography>
                            </Alert>
                        )} */}

                        <Divider sx={{ borderColor: '#666', my: 2 }} />

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Button variant="contained" startIcon={<Download />} onClick={handleDownload}
                                sx={{ backgroundColor: '#16a34a' }}>
                                Download Unscrambled Image
                            </Button>
                            {/* {fingerprintedUrl && unscrambledUrl !== fingerprintedUrl && (
                                <Button variant="outlined" startIcon={<Download />}
                                    onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = unscrambledUrl;
                                        a.download = `unscrambled_raw_${Date.now()}.png`;
                                        a.click();
                                    }}
                                    sx={{ color: '#94a3b8', borderColor: '#94a3b8' }}>
                                    Download Raw (no fingerprint)
                                </Button>
                            )} */}
                        </Box>
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
                actionType="unscramble"
            />
            <ProcessingModal open={isProcessing} />
        </Container>
    );
}
