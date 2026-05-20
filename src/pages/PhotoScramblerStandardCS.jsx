// PhotoScramblerStandardCS.jsx — Client-Side Standard Photo Scrambler
// Single algorithm: tile position shuffle + per-tile flip (src_idx % 4), matching scramble_photo.py.
// Key format: version "standard-cs" — use PhotoUnscramblerStandardCS to reverse.

import React, { useState, useRef, useCallback } from 'react';
import {
    Container, Typography, Card, CardContent, Button, TextField,
    Box, Grid, Chip, Alert, Slider, CircularProgress, Paper
} from '@mui/material';
import {
    PhotoCamera, Shuffle, Download, ContentCopy, CloudUpload, AutoAwesome, Casino
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

// ═══════════════════════════════════════════════════════
// PURE ALGORITHM FUNCTIONS
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

function invertPermArr(perm) {
    const inv = new Array(perm.length);
    for (let i = 0; i < perm.length; i++) inv[perm[i]] = i;
    return inv;
}

/** Build a position permutation where only ~percentage% of tiles move. */
function buildPosPerm(N, seed, percentage) {
    const count = Math.max(1, Math.floor(N * percentage / 100));
    const selOrder = seededPermutation(N, (seed ^ 0xDEADBEEF) >>> 0);
    const selected = selOrder.slice(0, count);
    const subPerm = seededPermutation(count, seed);
    const perm = Array.from({ length: N }, (_, i) => i); // identity
    for (let i = 0; i < count; i++) perm[selected[subPerm[i]]] = selected[i];
    return perm; // perm[dest] = src
}

// ─── tile helpers ────────────────────────────────────────────────────────────

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

// ─── noise helpers ────────────────────────────────────────────────────────────

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

function applyNoiseAdd(pixels, w, h, offsets, tileSize) {
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

// ─── main scramble entry point ────────────────────────────────────────────────
// Single algorithm: position shuffle + per-tile flip where flipMode = src_idx % 4.
// Matches scramble_photo.py's scramble_frame() behaviour exactly.

function standardScramble(imgData, seed, rows, cols, percentage, noiseIntensity, noiseSeed) {
    const { data: src, width: W, height: H } = imgData;
    const n = rows, m = cols;
    const tileW = Math.floor(W / m), tileH = Math.floor(H / n);
    const N = n * m;

    // Build position permutation: perm[dest] = src
    const perm = buildPosPerm(N, seed, percentage);

    // Extract all source tiles from original image
    const srcPixels = new Uint8ClampedArray(src);
    const srcTiles = [];
    for (let r = 0; r < n; r++)
        for (let c = 0; c < m; c++)
            srcTiles.push(extractTile(srcPixels, W, c * tileW, r * tileH, tileW, tileH));

    // Build output: scrambled[dest] = flip(perm[dest] % 4, original[perm[dest]])
    const outPx = new Uint8ClampedArray(W * H * 4);
    for (let i = 3; i < outPx.length; i += 4) outPx[i] = 255;
    for (let dest = 0; dest < N; dest++) {
        const srcIdx = perm[dest];
        const flipped = flipTile(srcTiles[srcIdx], tileW, tileH, srcIdx % 4);
        const r = Math.floor(dest / m), c = dest % m;
        placeTile(outPx, W, c * tileW, r * tileH, flipped, tileW, tileH);
    }

    let pixels = outPx;

    // Noise layer
    let noiseTileSize = null;
    if (noiseIntensity > 0) {
        noiseTileSize = Math.min(512, Math.max(64, Math.min(W, H) >> 2));
        pixels = applyNoiseAdd(pixels, W, H,
            generateNoiseTileOffsets(noiseTileSize, noiseSeed, noiseIntensity),
            noiseTileSize);
    }

    return { pixels, perm1based: perm.map(x => x + 1), noiseTileSize };
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export default function PhotoScramblerStandardCS() {
    const { success, error, info } = useToast();

    const fileInputRef    = useRef(null);
    const imageRef        = useRef(null);
    const scrambleImageRef = useRef(null);

    // File
    const [selectedFile, setSelectedFile]   = useState(null);
    const [previewUrl, setPreviewUrl]       = useState('');
    const [imageLoaded, setImageLoaded]     = useState(false);
    const [scrambledUrl, setScrambledUrl]   = useState('');

    // Settings
    const [seed, setSeed]                       = useState(() => genRandomSeed());
    const [rows, setRows]                       = useState(8);
    const [cols, setCols]                       = useState(8);
    const [percentage, setPercentage]           = useState(100);
    const [noiseIntensity, setNoiseIntensity]   = useState(30);

    // Key
    const [keyCode, setKeyCode]     = useState('');

    // Credits
    const [isProcessing, setIsProcessing]       = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [allowScrambling, setAllowScrambling] = useState(false);
    const [actionCost, setActionCost]           = useState(10);
    const [scrambleLevel, setScrambleLevel]     = useState(1);
    const [userData]                             = useState(() => JSON.parse(localStorage.getItem('userdata') || 'null'));
    const [userCredits, setUserCredits]         = useState(0);

    // ─── credit helpers ────────────────────────────────────────────────────
    const getActualCost = () => parseInt(localStorage.getItem('lastActionCost')) || actionCost;

    const handleRefundCredits = async (cost) => {
        await refundCredits({
            userId: userData?.id, username: userData?.username, email: userData?.email,
            credits: getActualCost(), currentCredits: userCredits,
            password: localStorage.getItem('hashedPassword'),
            action: 'scramble-photo-standard-cs',
            params: { seed, rows, cols, percentage }
        }).catch(() => {});
        error('Scrambling failed. Credits refunded.');
    };

    const confirmSpendingCredits = () => {
        if (!imageLoaded) { error('Please select an image first'); return; }
        setScrambleLevel(Math.max(rows, cols));
        setShowCreditModal(true);
    };

    const handleCreditConfirm = useCallback((actualCostSpent) => {
        setShowCreditModal(false);
        setAllowScrambling(true);
        setActionCost(actualCostSpent);
        setTimeout(() => { scrambleImageRef.current(actualCostSpent); }, 0);
    }, []);

    // ─── file handling ─────────────────────────────────────────────────────
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
            img.onload = () => { setImageLoaded(true); URL.revokeObjectURL(url); };
            img.onerror = () => { error('Failed to load image'); URL.revokeObjectURL(url); };
            img.src = url;
        }
    };

    // ─── main scramble ──────────────────────────────────────────────────────
    const scrambleImage = useCallback(async (cost) => {
        if (!selectedFile || !imageRef.current?.naturalWidth) {
            error('Please select an image first'); return;
        }
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 50));

        try {
            const img = imageRef.current;
            const W = img.naturalWidth, H = img.naturalHeight;
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = H;
            canvas.getContext('2d').drawImage(img, 0, 0);
            const imgData = canvas.getContext('2d').getImageData(0, 0, W, H);

            const noiseSeed = genRandomSeed();
            const { pixels, perm1based, noiseTileSize } = standardScramble(
                imgData, seed, rows, cols, percentage, noiseIntensity, noiseSeed
            );

            const outCanvas = document.createElement('canvas');
            outCanvas.width = W; outCanvas.height = H;
            outCanvas.getContext('2d').putImageData(new ImageData(pixels, W, H), 0, 0);
            const dataUrl = outCanvas.toDataURL('image/png');
            setScrambledUrl(dataUrl);

            const key = {
                type: 'photo',
                version: 'standard-cs',
                algorithm: 'position_mirror',
                seed,
                rows,
                cols,
                percentage,
                perm1based,
                noise: {
                    seed: noiseSeed,
                    intensity: noiseIntensity,
                    tile_size: noiseTileSize,
                    mode: 'add_mod256_tile',
                    prng: 'mulberry32',
                },
                timestamp: Date.now(),
                creator: {
                    username: userData?.username ?? 'Anonymous',
                    userId: userData?.id ?? 'Unknown',
                    timestamp: new Date().toISOString(),
                },
                metadata: {
                    filename: selectedFile.name,
                    size: selectedFile.size,
                    fileType: selectedFile.type,
                    dimensions: { width: W, height: H },
                },
            };
            setKeyCode(btoa(JSON.stringify(key)));

            api.post('/api/analytics/scramble-event', {
                username: userData?.username, userId: userData?.id,
                scrambleType: 'photo-standard-cs', scrambleLevel: Math.max(rows, cols),
                timestamp: new Date().toISOString(), actionCost: cost,
                mediaDetails: { name: selectedFile.name, size: selectedFile.size, width: W, height: H },
            }).catch(() => {});

            success('Image scrambled successfully!');
            setTimeout(() => info(`${cost} credits spent.`), 1500);
        } catch (err) {
            console.error('Scramble error:', err);
            error('Scrambling failed: ' + err.message);
            handleRefundCredits(cost);
        } finally {
            setIsProcessing(false);
            setAllowScrambling(false);
        }
    }, [selectedFile, seed, rows, cols, percentage, noiseIntensity, userData]);

    scrambleImageRef.current = scrambleImage;

    // ─── key helpers ───────────────────────────────────────────────────────
    const copyKey = async () => {
        if (!keyCode) { error('Scramble an image first'); return; }
        await navigator.clipboard.writeText(keyCode).then(() => success('Key copied!')).catch(() => error('Copy failed'));
    };

    const downloadKey = () => {
        if (!keyCode) { error('Scramble an image first'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([keyCode], { type: 'text/plain' }));
        a.download = `key_${selectedFile?.name ?? 'photo'}_${Date.now()}.txt`;
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

    return (
        <Container sx={{ py: 4 }}>
            <img ref={imageRef} style={{ display: 'none' }} alt="" crossOrigin="anonymous" />

            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ mb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <AutoAwesome /> 🚀 Photo Scrambler Standard
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Client-side version — tile shuffle + flip, no upload required
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="Client-Side" size="small" color="success" />
                    <Chip label="Tile Shuffle + Flip" size="small" color="primary" />
                    <Chip label="PNG/JPG" size="small" />
                </Box>
            </Box>

            {/* ── Step 1: File ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>Step 1</Typography>
                        <Typography variant="h6">Select Image File</Typography>
                    </Box>
                    <input type="file" accept="image/*" onChange={handleFileSelect}
                        style={{ display: 'none' }} id="cs-std-scramble-input" ref={fileInputRef} />
                    <label htmlFor="cs-std-scramble-input">
                        <Button variant="contained" component="span" startIcon={<PhotoCamera />}
                            sx={{ backgroundColor: '#2196f3' }}>
                            Choose Image File
                        </Button>
                    </label>
                    {selectedFile && (
                        <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                            ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                            {imageRef.current?.naturalWidth ? ` — ${imageRef.current.naturalWidth}×${imageRef.current.naturalHeight}px` : ''}
                        </Typography>
                    )}
                    {previewUrl && (
                        <Box sx={{ mt: 2 }}>
                            <img src={previewUrl} alt="Preview"
                                style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, border: '1px solid #666' }} />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ── Step 2: Settings ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                        <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>Step 2</Typography>
                        <Typography variant="h6">Configure Scrambling</Typography>
                    </Box>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <TextField fullWidth type="number" label="Seed" value={seed}
                                onChange={e => setSeed(parseInt(e.target.value) || 0)}
                                InputProps={{
                                    sx: { backgroundColor: '#353535', color: 'white' },
                                    endAdornment: (
                                        <Button size="small" onClick={() => setSeed(genRandomSeed())}
                                            startIcon={<Casino />} sx={{ color: '#22d3ee', minWidth: 'auto' }}>
                                            New
                                        </Button>
                                    )
                                }}
                                InputLabelProps={{ sx: { color: '#ccc' } }} />
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <TextField fullWidth type="number" label="Rows" value={rows}
                                onChange={e => setRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                InputLabelProps={{ sx: { color: '#ccc' } }} />
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <TextField fullWidth type="number" label="Cols" value={cols}
                                onChange={e => setCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                InputLabelProps={{ sx: { color: '#ccc' } }} />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="body1" sx={{ color: '#e0e0e0', mb: 1 }}>
                                Scrambling Percentage: {percentage}%
                            </Typography>
                            <Slider value={percentage} onChange={(_, v) => setPercentage(v)}
                                min={25} max={100} step={5}
                                marks={[{value:25,label:'25%'},{value:50,label:'50%'},{value:75,label:'75%'},{value:100,label:'100%'}]}
                                sx={{ color: '#22d3ee' }} />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="body1" sx={{ color: '#e0e0e0', mb: 1 }}>
                                Noise Intensity: {noiseIntensity} {noiseIntensity === 0 ? '(off)' : ''}
                            </Typography>
                            <Slider value={noiseIntensity} onChange={(_, v) => setNoiseIntensity(v)}
                                min={0} max={127} step={1}
                                marks={[{value:0,label:'Off'},{value:30,label:'30'},{value:64,label:'64'},{value:127,label:'127'}]}
                                sx={{ color: '#22d3ee' }} />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* ── Step 3: Scramble ── */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>Step 3</Typography>
                        <Typography variant="h6">Scramble Image</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                        <Button variant="contained"
                            onClick={confirmSpendingCredits}
                            startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                            disabled={!imageLoaded || isProcessing}
                            sx={{ backgroundColor: (!imageLoaded || isProcessing) ? '#555' : '#22d3ee', color: '#001018', fontWeight: 'bold' }}>
                            {isProcessing ? 'Processing…' : 'Scramble Image'}
                        </Button>
                        <Button variant="contained" startIcon={<Download />}
                            onClick={downloadScrambled} disabled={!scrambledUrl}
                            sx={{ backgroundColor: '#9c27b0', color: 'white' }}>
                            Download Scrambled
                        </Button>
                    </Box>
                    {isProcessing && (
                        <Typography variant="body2" sx={{ color: '#aaa' }}>
                            Processing in browser — may take a few seconds for large images…
                        </Typography>
                    )}
                    {(!imageLoaded) && (
                        <Alert severity="warning" sx={{ mt: 1, backgroundColor: '#4a2000', color: '#fde68a' }}>
                            ⚠️ Please select an image first
                        </Alert>
                    )}

                    {/* Side-by-side preview */}
                    <Grid container spacing={2} sx={{ mt: 2, borderTop: '1px solid #666', pt: 2 }}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>Original Image</Typography>
                            <Box sx={{ minHeight: 200, backgroundColor: '#0b1020', border: '1px dashed #666', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {previewUrl
                                    ? <img src={previewUrl} alt="Original" style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8 }} />
                                    : <Typography variant="body2" sx={{ color: '#666' }}>Select an image to preview</Typography>
                                }
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>Scrambled Image</Typography>
                            <Box sx={{ minHeight: 200, backgroundColor: '#0b1020', border: '1px dashed #666', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {scrambledUrl
                                    ? <img src={scrambledUrl} alt="Scrambled" style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8 }} />
                                    : <Typography variant="body2" sx={{ color: '#666' }}>Scrambled image will appear here</Typography>
                                }
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* ── Key ── */}
            {keyCode && (
                <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h5" sx={{ mb: 2 }}>🔑 Unscramble Key</Typography>
                        <Alert severity="warning" sx={{ mb: 2, backgroundColor: '#4a3000', color: '#fde68a' }}>
                            Save this key — it is needed to restore your image. Use the Client-Side Standard Unscrambler.
                        </Alert>
                        <TextField fullWidth multiline rows={3} value={keyCode} readOnly
                            InputProps={{ sx: { backgroundColor: '#252525', color: '#a5f3fc', fontFamily: 'monospace', fontSize: '0.7rem' } }}
                            sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Button variant="outlined" startIcon={<ContentCopy />} onClick={copyKey}
                                sx={{ color: '#22d3ee', borderColor: '#22d3ee' }}>Copy Key</Button>
                            <Button variant="contained" startIcon={<Download />} onClick={downloadKey}
                                sx={{ backgroundColor: '#0369a1' }}>Download Key</Button>
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
                actionType="scramble-photo-standard"
            />
            <ProcessingModal open={isProcessing} mediaType="photo" />

            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mt: 2 }}>
                <Typography variant="body2" color="black">
                    💡 <strong>Client-Side Version:</strong> All scrambling happens locally in your browser — no image is uploaded to any server.
                    Keys generated here require the <em>Client-Side Standard Unscrambler</em> to reverse.
                </Typography>
            </Paper>
        </Container>
    );
}
