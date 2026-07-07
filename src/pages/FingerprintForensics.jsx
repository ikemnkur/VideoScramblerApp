// FingerprintForensics.jsx
// Forensic tool to identify which user received a fingerprinted image copy.
//
// Two modes:
//  1. Auto Search — paste a list of usernames/IDs, brute-force compare each
//     user's expected transform against the suspect image, rank by similarity.
//  2. Manual Alignment — drag sliders to align the original on top of the
//     suspect image; "Find Closest Users" then searches the list for whoever
//     has params nearest to the manually-found values.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Container, Typography, Card, CardContent, Box, Grid, Paper,
    Button, TextField, Tabs, Tab, LinearProgress, Slider, Chip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Alert, Divider, CircularProgress, Tooltip, IconButton,
    ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
    Search, Upload, BarChart, RestartAlt, Download, ContentCopy, ArrowForward,
} from '@mui/icons-material';

// ─── Fingerprint utilities — must match PhotoUnscramblerStandard.jsx exactly ─

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

/** Derive transform params — keep in sync with paramsFromB in PhotoUnscramblerStandard.jsx */
function paramsFromB(B) {
    const seed = seedFromInt(B);
    const rnd  = mulberry32(seed);
    const angleDeg = (rnd() * 4) - 2;          // ±2°
    const angle    = angleDeg * Math.PI / 180;
    const zoom     = 1.05 + rnd() * 0.05;      // 1.05–1.07×
    const shiftX   = (rnd() * 2 - 1) * 12;    // ±12 px
    const shiftY   = (rnd() * 2 - 1) * 12;
    return { B, angle, angleDeg, zoom, shiftX, shiftY };
}

// ─── Low-level image utilities ────────────────────────────────────────────────

function sampleBilinear(data, w, h, x, y) {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return [0, 0, 0];
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
    const dx = x - x0, dy = y - y0;
    const g = (xx, yy) => (yy * w + xx) * 4;
    const p00 = g(x0, y0), p10 = g(x1, y0), p01 = g(x0, y1), p11 = g(x1, y1);
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
        const v0 = data[p00 + c] * (1 - dx) + data[p10 + c] * dx;
        const v1 = data[p01 + c] * (1 - dx) + data[p11 + c] * dx;
        out[c] = v0 * (1 - dy) + v1 * dy;
    }
    return out;
}

/**
 * Apply fingerprint warp (encode direction: original → fingerprinted).
 * srcData: Uint8ClampedArray from ImageData.  Returns new Uint8ClampedArray.
 */
function applyWarp(srcData, w, h, params) {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const ca = Math.cos(params.angle), sa = Math.sin(params.angle);
    const zoom = params.zoom || 1.0;
    const sx = params.shiftX, sy = params.shiftY;
    const out = new Uint8ClampedArray(srcData.length);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i  = (y * w + x) * 4;
            const px = x - cx, py = y - cy;
            const rx = px * ca - py * sa;
            const ry = px * sa + py * ca;
            const p  = sampleBilinear(srcData, w, h, rx / zoom - sx + cx, ry / zoom - sy + cy);
            out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; out[i + 3] = 255;
        }
    }
    return out;
}

/** Mean Absolute Difference (lower = more similar). */
function computeMAD(a, b) {
    let sum = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) {
        sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        n += 3;
    }
    return sum / n;
}

function madToScore(mad) {
    return Math.max(0, 100 * (1 - mad / 255));
}

/**
 * Load a File into an ImageData capped at maxSize px on the longest side.
 * Returns { imgData: ImageData, w, h }
 */
function loadImageData(file, maxSize = 400) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            // maxSize = Infinity means full resolution (no downscale)
            const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
            const w = Math.round(img.naturalWidth  * scale);
            const h = Math.round(img.naturalHeight * scale);
            const cvs = document.createElement('canvas');
            cvs.width = w; cvs.height = h;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            // scale is stored so callers can convert original-pixel params to working-image space
            resolve({ imgData: ctx.getImageData(0, 0, w, h), w, h, scale });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
        img.src = url;
    });
}

/** Resize an ImageData to target dimensions, returns Uint8ClampedArray. */
function resizeData(srcImgData, srcW, srcH, tgtW, tgtH) {
    if (srcW === tgtW && srcH === tgtH) return srcImgData.data;
    const src = document.createElement('canvas');
    src.width = srcW; src.height = srcH;
    src.getContext('2d').putImageData(srcImgData, 0, 0);
    const dst = document.createElement('canvas');
    dst.width = tgtW; dst.height = tgtH;
    dst.getContext('2d').drawImage(src, 0, 0, tgtW, tgtH);
    return dst.getContext('2d').getImageData(0, 0, tgtW, tgtH).data;
}

/** Export results array as a CSV string */
function toCSV(rows) {
    const header = 'rank,username,score_pct,mad,angle_deg,zoom,shift_x,shift_y';
    const lines = rows.map((r, i) =>
        `${i + 1},${r.name},${r.score.toFixed(3)},${r.mad.toFixed(3)},` +
        `${r.params.angleDeg.toFixed(4)},${r.params.zoom.toFixed(6)},` +
        `${r.params.shiftX.toFixed(3)},${r.params.shiftY.toFixed(3)}`
    );
    return [header, ...lines].join('\n');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FingerprintForensics() {
    // Images
    const [origFile, setOrigFile] = useState(null);
    const [fpFile,   setFpFile]   = useState(null);
    const [origImg,  setOrigImg]  = useState(null);  // {imgData, w, h}
    const [fpImg,    setFpImg]    = useState(null);
    const [origPrev, setOrigPrev] = useState('');
    const [fpPrev,   setFpPrev]   = useState('');

    // Tab
    const [tab, setTab] = useState(0);

    // Analysis mode: 'perf' = 400 px thumbnail | 'hq' = full resolution
    const [mode, setMode] = useState('perf');

    // Auto-search
    const [userList,    setUserList]    = useState('');
    const [searching,   setSearching]   = useState(false);
    const [progress,    setProgress]    = useState({ done: 0, total: 0 });
    const [results,     setResults]     = useState([]);
    const stopRef = useRef(false);

    // Manual alignment
    const [mAngle,  setMAngle]  = useState(0);
    const [mZoom,   setMZoom]   = useState(1.04);
    const [mShiftX, setMShiftX] = useState(0);
    const [mShiftY, setMShiftY] = useState(0);
    const [mScore,  setMScore]  = useState(null);
    const [paramHits, setParamHits] = useState([]);

    // JSON import for manual alignment
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');

    const overlayRef = useRef(null);
    const diffRef    = useRef(null);
    const rafRef     = useRef(null);

    // ── Load images when files change ────────────────────────────────────────
    useEffect(() => {
        if (!origFile) return;
        const maxSize = mode === 'hq' ? Infinity : 400;
        const url = URL.createObjectURL(origFile);
        setOrigPrev(url);
        loadImageData(origFile, maxSize).then(setOrigImg).catch(console.error);
        return () => URL.revokeObjectURL(url);
    }, [origFile, mode]);

    useEffect(() => {
        if (!fpFile) return;
        const maxSize = mode === 'hq' ? Infinity : 400;
        const url = URL.createObjectURL(fpFile);
        setFpPrev(url);
        loadImageData(fpFile, maxSize).then(setFpImg).catch(console.error);
        return () => URL.revokeObjectURL(url);
    }, [fpFile, mode]);

    // ── Overlay canvas update (manual tab) ───────────────────────────────────
    const drawOverlay = useCallback(() => {
        if (!origImg || !fpImg) return;
        const { imgData: origData, w, h } = origImg;
        const fpResized = resizeData(fpImg.imgData, fpImg.w, fpImg.h, w, h);

        // Slider values are in original-pixel space; scale to working-image space
        const s = origImg.scale;
        const params = {
            angle:  mAngle * Math.PI / 180,
            zoom:   mZoom,
            shiftX: mShiftX * s,
            shiftY: mShiftY * s,
        };
        const warped = applyWarp(origData.data, w, h, params);
        const mad    = computeMAD(warped, fpResized);
        setMScore(madToScore(mad));

        // Difference map (amplified ×5)
        if (diffRef.current) {
            const cvs = diffRef.current;
            cvs.width = w; cvs.height = h;
            const ctx  = cvs.getContext('2d');
            const diff = new Uint8ClampedArray(w * h * 4);
            for (let i = 0; i < warped.length; i += 4) {
                diff[i]     = Math.min(255, Math.abs(warped[i]     - fpResized[i])     * 5);
                diff[i + 1] = Math.min(255, Math.abs(warped[i + 1] - fpResized[i + 1]) * 5);
                diff[i + 2] = Math.min(255, Math.abs(warped[i + 2] - fpResized[i + 2]) * 5);
                diff[i + 3] = 255;
            }
            ctx.putImageData(new ImageData(diff, w, h), 0, 0);
        }

        // Overlay (warped original @ 50% over fingerprinted)
        if (overlayRef.current) {
            const cvs = overlayRef.current;
            cvs.width = w; cvs.height = h;
            const ctx = cvs.getContext('2d');
            // draw fingerprinted base
            ctx.putImageData(new ImageData(fpResized, w, h), 0, 0);
            // blend warped original at 50%
            const tmpCvs = document.createElement('canvas');
            tmpCvs.width = w; tmpCvs.height = h;
            tmpCvs.getContext('2d').putImageData(new ImageData(warped, w, h), 0, 0);
            ctx.globalAlpha = 0.5;
            ctx.drawImage(tmpCvs, 0, 0);
            ctx.globalAlpha = 1;
        }
    }, [origImg, fpImg, mAngle, mZoom, mShiftX, mShiftY]);

    // Debounce canvas update via RAF
    useEffect(() => {
        if (tab !== 1) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(drawOverlay);
    }, [tab, drawOverlay]);

    // ── Auto search ───────────────────────────────────────────────────────────
    const runSearch = async () => {
        if (!origImg || !fpImg) return;
        const names = userList.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        if (!names.length) return;

        setSearching(true);
        setResults([]);
        stopRef.current = false;
        setProgress({ done: 0, total: names.length });

        const { imgData: origData, w, h, scale } = origImg;
        const fpResized = resizeData(fpImg.imgData, fpImg.w, fpImg.h, w, h);

        let best = [];
        const BATCH = 40;

        for (let i = 0; i < names.length; i += BATCH) {
            if (stopRef.current) break;
            const batch = names.slice(i, i + BATCH);

            for (const name of batch) {
                const B      = userIdToTrackingNumber(name);
                const params = paramsFromB(B);
                // paramsFromB shifts are in original-pixel space; scale to working-image space
                const sParams = { ...params, shiftX: params.shiftX * scale, shiftY: params.shiftY * scale };
                const warped = applyWarp(origData.data, w, h, sParams);
                const mad    = computeMAD(warped, fpResized);
                best.push({ name, score: madToScore(mad), mad, params });
            }

            // Keep only top 50 to limit memory
            best.sort((a, b) => b.score - a.score);
            if (best.length > 50) best.length = 50;

            setProgress({ done: Math.min(i + BATCH, names.length), total: names.length });
            setResults(best.slice(0, 25));
            await new Promise(r => setTimeout(r, 0));   // yield to UI
        }
        setSearching(false);
    };

    // ── Find by manual params ─────────────────────────────────────────────────
    const findByParams = () => {
        const names = userList.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        if (!names.length) return;

        const hits = names.map(name => {
            const B = userIdToTrackingNumber(name);
            const p = paramsFromB(B);
            // Normalised Euclidean distance in 4D param space
            const da = (p.angleDeg - mAngle)  / 4;
            const dz = (p.zoom     - mZoom)   / 0.05;
            const dx = (p.shiftX   - mShiftX) / 12;
            const dy = (p.shiftY   - mShiftY) / 12;
            const dist = Math.sqrt(da * da + dz * dz + dx * dx + dy * dy);
            return { name, dist, params: p };
        });

        hits.sort((a, b) => a.dist - b.dist);
        setParamHits(hits.slice(0, 15));
    };

    // ── Export CSV ────────────────────────────────────────────────────────────
    const downloadCSV = () => {
        const csv  = toCSV(results);
        const blob = new Blob([csv], { type: 'text/csv' });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = 'fingerprint_forensics_results.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    // ── Apply a result row directly to the manual sliders ───────────────────
    const applyFromResult = (r) => {
        setMAngle(r.params.angleDeg);
        setMZoom(r.params.zoom);
        setMShiftX(r.params.shiftX);
        setMShiftY(r.params.shiftY);
        const json = JSON.stringify({
            name:     r.name,
            angleDeg: parseFloat(r.params.angleDeg.toFixed(5)),
            zoom:     parseFloat(r.params.zoom.toFixed(7)),
            shiftX:   parseFloat(r.params.shiftX.toFixed(3)),
            shiftY:   parseFloat(r.params.shiftY.toFixed(3)),
        }, null, 2);
        setJsonInput(json);
        setJsonError('');
        setTab(1);
    };

    const copyResultJSON = (r) => {
        const json = JSON.stringify({
            name:     r.name,
            score:    parseFloat(r.score.toFixed(3)),
            angleDeg: parseFloat(r.params.angleDeg.toFixed(5)),
            zoom:     parseFloat(r.params.zoom.toFixed(7)),
            shiftX:   parseFloat(r.params.shiftX.toFixed(3)),
            shiftY:   parseFloat(r.params.shiftY.toFixed(3)),
        }, null, 2);
        navigator.clipboard?.writeText(json);
    };

    const applyJSON = () => {
        try {
            const p      = JSON.parse(jsonInput);
            const angle  = parseFloat(p.angleDeg ?? p.angle  ?? 0);
            const zoom   = parseFloat(p.zoom  ?? 1.04);
            const shiftX = parseFloat(p.shiftX ?? 0);
            const shiftY = parseFloat(p.shiftY ?? 0);
            if ([angle, zoom, shiftX, shiftY].some(isNaN)) throw new Error('All values must be numbers');
            setMAngle( Math.max(-5,   Math.min(5,    angle)));
            setMZoom(  Math.max(0.97, Math.min(1.12, zoom)));
            setMShiftX(Math.max(-20,  Math.min(20,   shiftX)));
            setMShiftY(Math.max(-20,  Math.min(20,   shiftY)));
            setJsonError('');
        } catch (e) {
            setJsonError('Invalid JSON — ' + e.message);
        }
    };

    const ready = !!origImg && !!fpImg;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ fontWeight: 'bold', mb: 1 }}>
                    🔍 Fingerprint Forensics
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Identify which user received a fingerprinted copy of an image via transform correlation.
                </Typography>
            </Box>

            {/* Image Upload Row */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                    <UploadBox
                        label="Original (Clean) Image"
                        description="The unmodified source image before fingerprinting"
                        file={origFile}
                        preview={origPrev}
                        onChange={setOrigFile}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <UploadBox
                        label="Suspect Fingerprinted Image"
                        description="The image received from/by the suspected user"
                        file={fpFile}
                        preview={fpPrev}
                        onChange={setFpFile}
                    />
                </Grid>
            </Grid>

            {!ready && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    Upload both images above to start analysis.
                </Alert>
            )}

            {/* Algorithm info banner */}
            <Alert severity="info" sx={{ mb: 3, backgroundColor: '#0d2b45', color: '#93c5fd' }}>
                <Typography variant="body2">
                    <strong>How the fingerprint works:</strong> Each user's copy is uniquely transformed with a
                    deterministic rotate + zoom + shift derived from their user ID.
                    Ranges: <strong>angle ±2°</strong>, <strong>zoom 1.05–1.07×</strong>, <strong>shift ±12 px</strong>.
                    The score shown is 100 − (MAD / 2.55) where MAD is the mean absolute pixel difference
                    after applying each candidate's expected transform to the original.
                    A genuine match typically scores <strong>≥ 95%</strong>.
                </Typography>
            </Alert>

            {/* ── Analysis Mode ── */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: '#aaa', fontWeight: 'bold', flexShrink: 0 }}>
                    Analysis Mode:
                </Typography>
                <ToggleButtonGroup
                    value={mode} exclusive
                    onChange={(_, v) => { if (v) { setMode(v); setResults([]); } }}
                    size="small"
                >
                    <ToggleButton
                        value="perf"
                        sx={{ color: '#aaa', borderColor: '#555',
                            '&.Mui-selected': { color: '#22d3ee', backgroundColor: '#0d3344', borderColor: '#22d3ee' } }}
                    >
                        ⚡ Performance
                    </ToggleButton>
                    <ToggleButton
                        value="hq"
                        sx={{ color: '#aaa', borderColor: '#555',
                            '&.Mui-selected': { color: '#4ade80', backgroundColor: '#0d2b1a', borderColor: '#4ade80' } }}
                    >
                        🎯 High Accuracy
                    </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" sx={{ color: '#666' }}>
                    {mode === 'perf'
                        ? 'Thumbnail 400 px — fast; good for large candidate lists'
                        : 'Full resolution — accurate shift matching; slower for large images'
                    }
                </Typography>
                {origImg && (
                    <Typography variant="caption" sx={{ color: '#555', fontFamily: 'monospace' }}>
                        working: {origImg.w}×{origImg.h}
                        {origImg.scale < 1 ? ` (scale ×${origImg.scale.toFixed(3)})` : ' (full res)'}
                    </Typography>
                )}
            </Box>

            {/* Tabs */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white' }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{ borderBottom: '1px solid #666', px: 2, pt: 1 }}
                    TabIndicatorProps={{ style: { backgroundColor: '#22d3ee' } }}
                >
                    <Tab label="Auto Search" sx={{ color: '#e0e0e0', '&.Mui-selected': { color: '#22d3ee' } }} />
                    <Tab label="Manual Alignment" sx={{ color: '#e0e0e0', '&.Mui-selected': { color: '#22d3ee' } }} />
                </Tabs>

                <CardContent sx={{ p: 3 }}>
                    {/* ── Auto Search ── */}
                    {tab === 0 && (
                        <Grid container spacing={3}>
                            {/* Left: username list */}
                            <Grid item xs={12} md={4}>
                                <Typography variant="h6" sx={{ mb: 1, color: '#22d3ee' }}>
                                    User ID List
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1 }}>
                                    One entry per line (or comma/semicolon-separated).
                                    Accepts usernames, numeric IDs, or any string — the same input as used when fingerprinting.
                                </Typography>
                                <TextField
                                    fullWidth multiline rows={16}
                                    placeholder={"alice\nbob\ncharlie\n1234567890\n..."}
                                    value={userList}
                                    onChange={e => setUserList(e.target.value)}
                                    InputProps={{
                                        sx: {
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem',
                                            backgroundColor: '#333',
                                            color: 'white',
                                        },
                                    }}
                                />
                                <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                                    <Button
                                        variant="contained"
                                        onClick={runSearch}
                                        startIcon={searching ? <CircularProgress size={16} sx={{ color: '#001018' }} /> : <Search />}
                                        disabled={!ready || searching || !userList.trim()}
                                        sx={{ backgroundColor: '#22d3ee', color: '#001018', fontWeight: 'bold' }}
                                    >
                                        {searching
                                            ? `Searching ${progress.done}/${progress.total}…`
                                            : `Search ${userList.split(/[\n,;]+/).filter(s => s.trim()).length || 0} candidates`
                                        }
                                    </Button>
                                    {searching && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => { stopRef.current = true; }}
                                            sx={{ color: '#f87171', borderColor: '#f87171' }}
                                        >
                                            Stop
                                        </Button>
                                    )}
                                </Box>
                                {searching && (
                                    <LinearProgress
                                        variant="determinate"
                                        value={progress.total ? (progress.done / progress.total) * 100 : 0}
                                        sx={{
                                            mt: 1.5,
                                            backgroundColor: '#555',
                                            '& .MuiLinearProgress-bar': { backgroundColor: '#22d3ee' },
                                        }}
                                    />
                                )}
                            </Grid>

                            {/* Right: results */}
                            <Grid item xs={12} md={8}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="h6" sx={{ color: '#22d3ee' }}>
                                        Results {results.length > 0 ? `(top ${results.length})` : ''}
                                    </Typography>
                                    {results.length > 0 && (
                                        <Tooltip title="Download as CSV">
                                            <IconButton onClick={downloadCSV} sx={{ color: '#22d3ee' }} size="small">
                                                <Download />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Box>

                                {results.length > 0 ? (
                                    <TableContainer
                                        component={Paper}
                                        sx={{ backgroundColor: '#333', maxHeight: 480 }}
                                    >
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow sx={{ '& th': { backgroundColor: '#1a1a2e', color: '#22d3ee', fontWeight: 'bold', borderColor: '#555' } }}>
                                                    <TableCell>#</TableCell>
                                                    <TableCell>Username / ID</TableCell>
                                                    <TableCell align="right">Score</TableCell>
                                                    <TableCell align="right">MAD</TableCell>
                                                    <TableCell align="right">Angle °</TableCell>
                                                    <TableCell align="right">Zoom ×</TableCell>
                                                    <TableCell align="right">Shift X</TableCell>
                                                    <TableCell align="right">Shift Y</TableCell>
                                                    <TableCell align="center">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {results.map((r, i) => (
                                                    <TableRow
                                                        key={r.name}
                                                        sx={{
                                                            backgroundColor: i === 0 ? '#0f2b0f' : undefined,
                                                            '& td': { color: '#e0e0e0', borderColor: '#4a4a4a' },
                                                        }}
                                                    >
                                                        <TableCell sx={{ color: i === 0 ? '#4ade80 !important' : '#888' }}>
                                                            {i === 0 ? '🥇' : i + 1}
                                                        </TableCell>
                                                        <TableCell sx={{
                                                            fontFamily: 'monospace',
                                                            fontWeight: i < 3 ? 'bold' : 'normal',
                                                            color: i === 0 ? '#4ade80 !important' : undefined,
                                                        }}>
                                                            {r.name}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Chip
                                                                label={`${r.score.toFixed(1)}%`}
                                                                size="small"
                                                                color={r.score > 95 ? 'success' : r.score > 85 ? 'warning' : 'default'}
                                                                sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {r.mad.toFixed(2)}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {r.params.angleDeg.toFixed(3)}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {r.params.zoom.toFixed(5)}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {r.params.shiftX.toFixed(2)}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {r.params.shiftY.toFixed(2)}
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                                                            <Tooltip title="Copy params as JSON">
                                                                <IconButton size="small" onClick={() => copyResultJSON(r)} sx={{ color: '#22d3ee', p: 0.5 }}>
                                                                    <ContentCopy sx={{ fontSize: 15 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Apply to Manual Alignment tab">
                                                                <IconButton size="small" onClick={() => applyFromResult(r)} sx={{ color: '#a78bfa', p: 0.5 }}>
                                                                    <ArrowForward sx={{ fontSize: 15 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Paper sx={{ p: 4, backgroundColor: '#333', textAlign: 'center' }}>
                                        <Typography variant="body2" sx={{ color: '#666' }}>
                                            {searching ? 'Comparing candidates…' : 'Results will appear here after search.'}
                                        </Typography>
                                    </Paper>
                                )}

                                {results.length > 0 && results[0].score > 90 && (
                                    <Alert severity="success" sx={{ mt: 2, backgroundColor: '#14532d', color: '#bbf7d0' }}>
                                        <Typography variant="body2">
                                            <strong>Strong match:</strong> <code>{results[0].name}</code> scores{' '}
                                            <strong>{results[0].score.toFixed(1)}%</strong>.
                                            This user is the likely recipient of the leaked copy.
                                        </Typography>
                                    </Alert>
                                )}
                                {results.length > 0 && results[0].score <= 90 && (
                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                        <Typography variant="body2">
                                            Best score is {results[0].score.toFixed(1)}% — no confident match.
                                            The actual user may not be in this list, or the image may have been re-compressed/cropped.
                                        </Typography>
                                    </Alert>
                                )}
                            </Grid>
                        </Grid>
                    )}

                    {/* ── Manual Alignment ── */}
                    {tab === 1 && (
                        <Grid container spacing={3}>
                            {/* Left: sliders */}
                            <Grid item xs={12} md={4}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" sx={{ color: '#22d3ee' }}>Transform Controls</Typography>
                                    <Tooltip title="Reset to defaults">
                                        <IconButton
                                            size="small"
                                            onClick={() => { setMAngle(0); setMZoom(1.04); setMShiftX(0); setMShiftY(0); }}
                                            sx={{ color: '#aaa' }}
                                        >
                                            <RestartAlt />
                                        </IconButton>
                                    </Tooltip>
                                </Box>

                                {[  // slider definitions
                                    { label: 'Angle',   hint: '±2° range',       val: mAngle,  set: setMAngle,  min: -5,   max: 5,    step: 0.005   },
                                    { label: 'Zoom',    hint: '1.05–1.07 range', val: mZoom,   set: setMZoom,   min: 0.97, max: 1.12, step: 0.00005 },
                                    { label: 'Shift X', hint: '±12 px range',    val: mShiftX, set: setMShiftX, min: -20,  max: 20,   step: 0.05    },
                                    { label: 'Shift Y', hint: '±12 px range',    val: mShiftY, set: setMShiftY, min: -20,  max: 20,   step: 0.05    },
                                ].map(({ label, hint, val, set, min, max, step }) => (
                                    <Box key={label} sx={{ mb: 1.5 }}>
                                        <Typography sx={{ color: '#e0e0e0', fontSize: '0.88rem', mb: 0.5 }}>
                                            {label}
                                            <Typography component="span" sx={{ color: '#666', fontSize: '0.73rem', ml: 1 }}>{hint}</Typography>
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Slider
                                                value={val} onChange={(_, v) => set(v)}
                                                min={min} max={max} step={step}
                                                sx={{ color: '#22d3ee' }}
                                            />
                                            <TextField
                                                size="small" type="number"
                                                value={val}
                                                onChange={e => {
                                                    const v = parseFloat(e.target.value);
                                                    if (!isNaN(v)) set(Math.max(min, Math.min(max, v)));
                                                }}
                                                inputProps={{ step }}
                                                sx={{
                                                    width: 92, flexShrink: 0,
                                                    '& input': { color: '#22d3ee', fontFamily: 'monospace', fontSize: '0.78rem', padding: '5px 6px' },
                                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                                                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#22d3ee' },
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                ))}

                                {mScore !== null && (
                                    <Alert
                                        severity={mScore > 95 ? 'success' : mScore > 80 ? 'warning' : 'error'}
                                        sx={{ mt: 3 }}
                                    >
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            Alignment score: {mScore.toFixed(2)}%
                                        </Typography>
                                        <Typography variant="caption">
                                            MAD: {((1 - mScore / 100) * 255).toFixed(2)}
                                            &nbsp;— aim for a dark diff map on the right
                                        </Typography>
                                    </Alert>
                                )}

                                <Divider sx={{ my: 2, backgroundColor: '#555' }} />

                                {/* ── JSON import ── */}
                                <Typography variant="subtitle2" sx={{ color: '#22d3ee', mb: 0.5 }}>Import from JSON</Typography>
                                <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
                                    Paste a copied result (from Auto Search) or any object with
                                    angleDeg, zoom, shiftX, shiftY keys.
                                </Typography>
                                <TextField
                                    fullWidth multiline rows={3}
                                    value={jsonInput}
                                    onChange={e => { setJsonInput(e.target.value); setJsonError(''); }}
                                    placeholder={'{ "angleDeg": 1.36, "zoom": 1.038, "shiftX": -3.9, "shiftY": 2.9 }'}
                                    InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem', backgroundColor: '#1a1a1a', color: '#a3e635' } }}
                                />
                                {jsonError && (
                                    <Typography variant="caption" sx={{ color: '#f87171', display: 'block', mt: 0.5 }}>
                                        {jsonError}
                                    </Typography>
                                )}
                                <Button
                                    variant="outlined" size="small"
                                    onClick={applyJSON}
                                    disabled={!jsonInput.trim()}
                                    sx={{ mt: 1, mb: 2, color: '#a3e635', borderColor: '#a3e635' }}
                                >
                                    Apply JSON
                                </Button>

                                <Divider sx={{ my: 1, backgroundColor: '#666' }} />

                                <Typography variant="h6" sx={{ mb: 1, color: '#a78bfa' }}>
                                    Find User by Params
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 2 }}>
                                    Searches the username list (from Auto tab) for whoever's expected transform
                                    is closest to the current slider values. No image comparison — pure param proximity.
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={findByParams}
                                    startIcon={<BarChart />}
                                    disabled={!userList.trim()}
                                    sx={{ backgroundColor: '#7c3aed', color: 'white', fontWeight: 'bold' }}
                                >
                                    Find Closest Users
                                </Button>

                                {paramHits.length > 0 && (
                                    <TableContainer component={Paper} sx={{ mt: 2, backgroundColor: '#2a2a3a' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ '& th': { backgroundColor: '#1a1a2e', color: '#a78bfa', fontWeight: 'bold', borderColor: '#555' } }}>
                                                    <TableCell>#</TableCell>
                                                    <TableCell>Username / ID</TableCell>
                                                    <TableCell align="right">Param dist</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {paramHits.map((r, i) => (
                                                    <TableRow key={r.name} sx={{ '& td': { color: '#e0e0e0', borderColor: '#555' } }}>
                                                        <TableCell sx={{ color: i === 0 ? '#c4b5fd !important' : '#888' }}>
                                                            {i === 0 ? '⭐' : i + 1}
                                                        </TableCell>
                                                        <TableCell sx={{
                                                            fontFamily: 'monospace',
                                                            fontWeight: i === 0 ? 'bold' : 'normal',
                                                            color: i === 0 ? '#c4b5fd !important' : undefined,
                                                        }}>
                                                            {r.name}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            {r.dist.toFixed(4)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Grid>

                            {/* Right: canvas preview */}
                            <Grid item xs={12} md={8}>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" sx={{ mb: 1, color: '#e0e0e0' }}>
                                            Overlay — Warped Original (50%) + Fingerprinted (50%)
                                        </Typography>
                                        <Box sx={{
                                            backgroundColor: '#111',
                                            borderRadius: 1,
                                            border: '1px solid #555',
                                            overflow: 'hidden',
                                            minHeight: 200,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            {ready
                                                ? <canvas ref={overlayRef} style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' }} />
                                                : <Typography variant="body2" sx={{ color: '#555' }}>Upload images first</Typography>
                                            }
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" sx={{ mb: 1, color: '#e0e0e0' }}>
                                            Difference Map (amplified ×5) — darker = better alignment
                                        </Typography>
                                        <Box sx={{
                                            backgroundColor: '#111',
                                            borderRadius: 1,
                                            border: '1px solid #555',
                                            overflow: 'hidden',
                                            minHeight: 200,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            {ready
                                                ? <canvas ref={diffRef} style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' }} />
                                                : <Typography variant="body2" sx={{ color: '#555' }}>Upload images first</Typography>
                                            }
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Alert severity="info" sx={{ mt: 2, backgroundColor: '#0d2b45', color: '#93c5fd' }}>
                                    <Typography variant="body2">
                                        <strong>Workflow:</strong> Adjust sliders until the difference map (right) is as dark as possible
                                        and the overlay (left) shows the images merging cleanly.
                                        Then paste a username list and click <em>"Find Closest Users"</em> to identify the likely recipient —
                                        or switch to <em>Auto Search</em> for a pixel-level comparison across the full list.
                                    </Typography>
                                </Alert>

                                {/* Current params readout */}
                                <Paper sx={{ mt: 2, p: 2, backgroundColor: '#2a2a2a', fontFamily: 'monospace', fontSize: '0.8rem', color: '#a3e635' }}>
                                    Current params: angle={mAngle.toFixed(4)}°  zoom={mZoom.toFixed(6)}  shiftX={mShiftX.toFixed(3)}  shiftY={mShiftY.toFixed(3)}
                                    <Tooltip title="Copy">
                                        <IconButton
                                            size="small"
                                            sx={{ ml: 1, color: '#a3e635' }}
                                            onClick={() => navigator.clipboard?.writeText(
                                                `angle=${mAngle.toFixed(4)} zoom=${mZoom.toFixed(6)} shiftX=${mShiftX.toFixed(3)} shiftY=${mShiftY.toFixed(3)}`
                                            )}
                                        >
                                            <ContentCopy fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </CardContent>
            </Card>

            {/* Footer note */}
            <Paper elevation={1} sx={{ p: 2, mt: 3, backgroundColor: '#1a2035' }}>
                <Typography variant="caption" sx={{ color: '#6b7280', lineHeight: 1.8 }}>
                    <strong style={{ color: '#9ca3af' }}>Technical note:</strong> The comparison score reflects how
                    well the expected transform for a candidate reproduces the suspect image from the original.
                    JPEG re-compression, cropping, or resizing of the suspect image will degrade all scores.
                    Scores above ~95% on clean PNG images strongly indicate a match; lower scores may still
                    identify the correct user if they rank significantly higher than all others.
                    The image data is processed entirely in the browser — nothing is uploaded to any server.
                </Typography>
            </Paper>
        </Container>
    );
}

// ─── Upload Box ───────────────────────────────────────────────────────────────

function UploadBox({ label, description, file, preview, onChange }) {
    const id = `fp-upload-${label.replace(/\W+/g, '-').toLowerCase()}`;
    return (
        <Paper elevation={2} sx={{ p: 2, backgroundColor: '#424242', color: 'white', height: '100%' }}>
            <Typography variant="subtitle1" sx={{ color: '#22d3ee', fontWeight: 'bold', mb: 0.5 }}>
                {label}
            </Typography>
            <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1 }}>
                {description}
            </Typography>
            <input
                type="file"
                accept="image/*"
                id={id}
                style={{ display: 'none' }}
                onChange={e => onChange(e.target.files?.[0] || null)}
            />
            <label htmlFor={id}>
                <Button
                    variant="outlined"
                    component="span"
                    startIcon={<Upload />}
                    size="small"
                    sx={{ color: '#22d3ee', borderColor: '#22d3ee', mb: 1 }}
                >
                    Choose Image
                </Button>
            </label>
            {file && (
                <Typography variant="caption" sx={{ display: 'block', color: '#4ade80', mb: 1 }}>
                    ✓ {file.name}
                </Typography>
            )}
            <Box sx={{
                minHeight: 180,
                backgroundColor: '#1a1a2e',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: '1px dashed #555',
            }}>
                {preview
                    ? <img src={preview} alt={label} style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }} />
                    : <Typography variant="body2" sx={{ color: '#444' }}>No image selected</Typography>
                }
            </Box>
        </Paper>
    );
}
