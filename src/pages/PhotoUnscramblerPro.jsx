// UnscramblerPhotosPro.jsx — Pro Photo Unscrambler with Python Backend
// Connects to Flask server on port 5000 for advanced unscrambling algorithms
// Supports: Position, Color, Rotation, Mirror, and Intensity unscrambling

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Button,
    TextField,
    Box,
    Grid,
    Paper,
    Chip,
    Alert,
    CircularProgress,
    Divider
} from '@mui/material';
import {
    PhotoCamera,
    LockOpen,
    Download,
    VpnKey,
    CloudDownload,
    AutoAwesome,
    CheckCircle,
    Error as ErrorIcon,
    Upload
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';
const Flask_API_URL = import.meta.env.VITE_API_PY_SERVER_URL || 'http://localhost:5000';

// ============================================================
// FINGERPRINT TRANSFORM UTILITIES
// Ported from imageHiddenWatermark.html
// Each user gets a deterministic-but-unique transform derived
// from their userId, making every distributed copy traceable.
// ============================================================

/** Mulberry32 seeded PRNG — fast, good distribution */
function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

/** Mix an integer into a 32-bit seed */
function seedFromInt(n) {
    let x = (Number(n) >>> 0);
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    return x >>> 0;
}

/**
 * Derive a stable 32-bit numeric tracking ID from the user's 10-char ID string.
 * Same userId always produces the same transform parameters.
 */
function userIdToTrackingNumber(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = (Math.imul(hash, 31) + userId.charCodeAt(i)) >>> 0;
    }
    return hash;
}

/** Generate deterministic transform parameters from tracking number B */
function paramsFromB(B) {
    const seed = seedFromInt(B);
    const rnd = mulberry32(seed);

    const angleDeg = (rnd() * 20) - 10;          // ±10°
    const angle = angleDeg * Math.PI / 180;
    const zoom = 1.05 + rnd() * 0.15;         // 1.05–1.20×
    const shiftX = (rnd() * 2 - 1) * 30;        // ±30px
    const shiftY = (rnd() * 2 - 1) * 30;
    const cropTop = 16 + Math.floor(rnd() * 49);
    const cropRight = 16 + Math.floor(rnd() * 49);
    const cropBottom = 16 + Math.floor(rnd() * 49);
    const cropLeft = 16 + Math.floor(rnd() * 49);

    return { B, angle, angleDeg, zoom, shiftX, shiftY, cropTop, cropRight, cropBottom, cropLeft };
}

/** Bilinear interpolation on an ImageData */
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

/**
 * Apply rotation + zoom + shift + crop + rescale to an ImageData.
 * applyInverse=false → encode (A→C), applyInverse=true → decode (C→A).
 */
function warpImage(srcImgData, params, applyInverse = false) {
    const w = srcImgData.width, h = srcImgData.height;
    const cx = (w - 1) / 2, cy = (h - 1) / 2;

    // Step 1: rotate + zoom + shift
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

    // Step 2: crop (values are non-zero but currently mirroring the HTML which uses 0 for crop)
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

    // Step 3: rescale back to original dimensions
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

/**
 * Load an image Blob, apply the user-specific fingerprint warp,
 * and return { dataUrl, params } for display + download.
 */
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
        return { dataUrl: canvas.toDataURL('image/png'), params };
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

export default function PhotoUnscramblerPro() {
    const { success, error } = useToast();

    // Refs
    const imageRef = useRef(null);
    const previewImg = useRef(null);
    const fileInputRef = useRef(null);
    const scrambledDisplayRef = useRef(null);
    const unscrambledDisplayRef = useRef(null);
    const keyFileInputRef = useRef(null);

    // State
    const [selectedFile, setSelectedFile] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [grid, setGrid] = useState({ n: 5, m: 5 });
    const [unscrambledFilename, setUnscrambledFilename] = useState('');
    const [keyCode, setKeyCode] = useState('');
    const [decodedKey, setDecodedKey] = useState(null);
    const [keyValid, setKeyValid] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');

    const [imageFile, setImageFile] = useState(null);

    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

    const [showCreditModal, setShowCreditModal] = useState(false);
    const [allowScrambling, setAllowScrambling] = useState(false);
    const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
    // const actionCost = 10; // Cost to scramble a photo (less than video)
    const [actionCost, setActionCost] = useState(15); // Cost to unscramble a photo (pro version)
    const [scrambleLevel, setScrambleLevel] = useState(1); // Level of scrambling (for credit calculation)

    const [fingerprintedUrl, setFingerprintedUrl] = useState(null);
    const [fingerprintParams, setFingerprintParams] = useState(null);

    const [creatorInfo, setCreatorInfo] = useState({
        username: 'Anonymous',
        userId: 'Unknown',
        time: new Date(Date.now() - 7 * Math.random() * 24 * 1000 * 3600).toISOString() // 7day - 24 hours ago, for testing
    });

    const [metadata, setMetadata] = useState({
        filename: "untitled.jpg",
        size: 2048000,
        fileType: ".mp4",
        dimensions: {
            width: 1920,
            height: 1080
        },
    });



    // ========== UTILITY FUNCTIONS ==========

    // Base64 encoding/decoding utilities
    const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));
    const fromBase64 = (b64) => decodeURIComponent(escape(atob(b64.trim())));

    // Array conversion utilities
    const oneBased = (a) => a.map(x => x + 1);
    const zeroBased = (a) => a.map(x => x - 1);

    // Calculate inverse permutation
    const inversePermutation = (arr) => {
        const inv = new Array(arr.length);
        for (let i = 0; i < arr.length; i++) inv[arr[i]] = i;
        return inv;
    };

    // Generate rectangle coordinates for grid cells
    const cellRects = (w, h, n, m) => {
        const rects = [];
        const cw = w / m, ch = h / n;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < m; c++) {
                rects.push({ x: c * cw, y: r * ch, w: cw, h: ch });
            }
        }
        return rects;
    };


    useEffect(() => {
        const fetchUserCredits = async () => {
            try {
                // JWT token in the Authorization header automatically authenticates the user
                // No need to send password (it's not stored in localStorage anyway)
                const { data } = await api.post(`/api/wallet/balance/${userData.username}`, {
                    email: userData.email
                });

            } catch (e) {
                console.error('Failed to load wallet balance:', e);

                // Handle authentication errors
                if (e.response?.status === 401 || e.response?.status === 403) {
                    error('Session expired. Please log in again.');
                    setTimeout(() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('userdata');
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    error('Failed to load balance. Please try again.');
                }
                setBalance(0);
            }

        };

        if (userData?.username) {
            fetchUserCredits();
        }
    }, [userData]);


    const handleCreditConfirm = useCallback((actualCostSpent) => {
        setShowCreditModal(false);
        setAllowScrambling(true);

        // Now you have access to the actual cost that was calculated and spent
        console.log('Credits spent:', actualCostSpent);

        // You can use this value for logging, analytics, or displaying to user
        setActionCost(localStorage.getItem('lastActionCost') || 0);



        // Use setTimeout to ensure state update completes before scrambling
        setTimeout(() => {
            unscrambleImage();
        }, 0);

    }, [selectedFile, allowScrambling]);



    // =============================
    // FILE HANDLING
    // =============================
    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            error("Please select a valid image file");
            return;
        }

        setSelectedFile(file);
        // localStorage.setItem("selectedImageFile", file);
        setImageFile(file); // Also set imageFile for scrambling logic
        // setUnscrambledFilename('');
        setKeyCode('');

        // Reset previous state
        // setPermDestToSrc0([]);
        // setBase64Key("");
        // setJsonKey("");
        // setImageLoaded(false);

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        // Load image into the hidden image ref for processing
        // if (imageRef.current) {
        setTimeout(() => {
            imageRef.current.onload = () => {
                console.log("Image loaded successfully");
                setImageLoaded(true);

                // Calculate cost after image has loaded
                const LQ = 2;
                const SDcharge = 3;
                const HDcharge = 5;
                const FHDCharge = 10;

                const width = imageRef.current?.naturalWidth || 0;
                const height = imageRef.current?.naturalHeight || 0;

                console.log('Photo Dimensions:', width, 'x', height);
                console.log('Photo Size:', file.size, 'bytes');

                let resolutionCost = LQ;
                if (width >= 1920 && height >= 1080) {
                    resolutionCost = FHDCharge;
                } else if (width >= 1280 && height >= 720) {
                    resolutionCost = HDcharge;
                } else if (width >= 854 && height >= 480) {
                    resolutionCost = SDcharge;
                } else {
                    resolutionCost = LQ;
                }

                let calculatedCost = Math.ceil(resolutionCost * (1 + file.size / (1000 * 1000 * 0.5))); // scale by size in MB over 0.5MB

                console.log('Calculated Photo Cost:', calculatedCost);

                setActionCost(calculatedCost);

                URL.revokeObjectURL(url);
            };

            imageRef.current.onerror = () => {
                console.error("Failed to load image");
                error("Failed to load the selected image");
                setImageLoaded(false);
                URL.revokeObjectURL(url);
            };

            imageRef.current.src = url;
            // }

            // slight delay to ensure state updates
        }, 100);

        console.log("Selected file:", file);

    };


    // =============================
    // KEY HANDLING
    // =============================

    const handleKeyFileSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();

            const decoded = fromBase64(text.trim());
            const keyData = JSON.parse(decoded);

            setKeyCode(text);

            // console.log("Loaded key file content:", text);
            console.log("Decoded key data:", keyData);

            // Try to parse the key file content
            // const keyData = JSON.parse(text);
            setDecodedKey(keyData);
            setKeyValid(true);
            success('🔑 Key file loaded and decoded successfully!');

        } catch (err) {
            console.error("Error loading key:", err);
            error('Invalid or corrupted key file. Please check the file format.');
        }
    };


    const decodeKey = () => {
        if (!keyCode || keyCode.trim() === '') {
            error("Please paste your unscramble key first");
            return;
        }

        try {
            // Decode base64 key
            // const jsonString = atob(keyCode.trim());
            const jsonString = fromBase64(keyCode.trim());

            const keyData = JSON.parse(jsonString);

            console.log("Decoded key data:", keyData);


            if (keyData.type !== "photo") {
                error('The loaded key file is not a valid photo scramble key.');
                console.error('The loaded key file is not a valid photo scramble key.');
                throw new Error("Invalid key format");
            } else if (keyData.version !== "premium" && keyData.version !== "standard") {
                error('Use the ' + keyData.version + ' ' + keyData.type + ' unscrambler to unscramble this file.');
                alert('The loaded key file will not work with this unscrambler version, you must use the ' + keyData.version + ' ' + keyData.type + ' unscrambler to unscramble this file.');
                console.error('The loaded key file is not compatible with this unscrambler version.');
                throw new Error("Invalid key format");
            }

            // Validate key structure
            if (!keyData.algorithm || !keyData.seed) {
                throw new Error("Invalid key format");
            }

            setCreatorInfo({
                username: keyData.creator?.username || 'Anonymous',
                userId: keyData.creator?.userId || 'Unknown',
                time: keyData.creator?.timestamp || new Date().toISOString()
            });

            setMetadata({
                filename: keyData.metadata?.filename || 'untitled.mp4',
                size: keyData.metadata?.size || 0,
                fileType: keyData.metadata?.fileType || '',
                dimensions: keyData.metadata?.dimensions || { width: 0, height: 0 },
                duration: keyData.metadata?.duration || 0,
                fps: keyData.metadata?.fps || 0
            });

            setDecodedKey(keyData);
            setKeyValid(true);
            success("Key decoded successfully!");

            console.log("Decoded key:", keyData);
        } catch (err) {
            console.error("Key decode error:", err);
            error("Invalid key format. Please check your key and try again.");
            setKeyValid(false);
            setDecodedKey(null);
        }
    };

    // =============================
    // API CALLS
    // =============================
    const unscrambleImage = async () => {
        if (!selectedFile) {
            error("Please select a scrambled image first");
            handleRefundCredits(actionCost);
            return;
        }

        if (!decodedKey || !keyValid) {
            error("Please decode your key first");
            handleRefundCredits(actionCost);
            return;
        }

        setIsProcessing(true);

        try {
            // Build unscramble parameters from decoded key
            const params = {
                input: selectedFile.name,
                output: `unscrambled_${selectedFile.name}`,
                seed: decodedKey.seed,
                mode: 'unscramble',
                algorithm: decodedKey.algorithm,
                rows: decodedKey.rows,
                cols: decodedKey.cols,
                percentage: decodedKey.percentage,
                max_hue_shift: decodedKey.maxHueShift,
                max_intensity_shift: decodedKey.maxIntensityShift,

                scrambleLevel: scrambleLevel,

                algorithm: decodedKey.scramble.algorithm,
                percentage: decodedKey.scramble.percentage,
                scramble: decodedKey.scramble,
                noise: decodedKey.noise,
                noise_seed: decodedKey.noise.noise_seed,
                noise_intensity: decodedKey.noise.noise_intensity,
                noise_mode: decodedKey.noise.noise_mode,
                noise_tile_size: decodedKey.noise.noise_tile_size,
                creator: {
                    username: decodedKey.creator.username || 'Anonymous',
                    userId: decodedKey.creator.userId || 'Unknown',
                    timestamp: decodedKey.creator.timestamp || new Date().toISOString()
                },
                metadata: decodedKey.metadata || {},
                user_id: userData.id,
                username: userData.username,
                type: "photo",
                version: "premium"

            };

            setScrambleLevel(params.cols >= params.rows ? params.cols : params.rows);

            console.log("Unscrambling with params:", params);

            // Create FormData with file and parameters
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('params', JSON.stringify(params));

            try {
                // Call unscramble endpoint
                const response = await api.post(`${API_URL}/api/unscramble-photo`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                // const data = await response.json();
                let data = response.data;

                console.log("Unscramble response:", response);

                if (!data.success) {
                    error("Scrambling failed: " + (data.message || "Unknown error"));
                    setIsProcessing(false);
                    handleRefundCredits(actionCost);
                    return;
                }


                // The backend should return the unscrambled image info
                setUnscrambledFilename(data.output_file || data.unscrambledFileName);

                // Load unscrambled image preview
                if (data.output_file || data.unscrambledFileName) {
                    loadUnscrambledImage(data.output_file || data.unscrambledFileName);
                } else if (data.unscrambledImageUrl) {
                    // If backend returns direct URL
                    if (unscrambledDisplayRef.current) {
                        unscrambledDisplayRef.current.src = data.unscrambledImageUrl;
                    }
                }

                success("Image unscrambled successfully!");

                // SHOW MESSAGE DIALOG SAYTHING THAT THE USER HAS SPENT CREDITS TO CHECK THE IMAGE


            } catch (error) {
                console.error("Error during unscrambling:", error);
                // TODO: Refund credits if applicable
                handleRefundCredits(actionCost);

            }

        } catch (err) {
            console.error("Unscramble error:", err);
            error("Unscrambling failed: " + err.message);
            handleRefundCredits(actionCost);
        } finally {
            setIsProcessing(false);
        }
    };

    const loadUnscrambledImage = async (filename) => {
        try {
            const response = await fetch(`${Flask_API_URL}/download/${filename}`);
            if (!response.ok) throw new Error('Failed to load unscrambled image');

            const blob = await response.blob();

            // Apply user-specific fingerprint transform so every distributed
            // copy carries a unique, invisible tracking signature.
            const userId = userData?.id || 'UNKNOWN';
            const { dataUrl, params } = await applyFingerprintTransform(blob, userId);

            setFingerprintedUrl(dataUrl);
            setFingerprintParams(params);

            console.log('Fingerprint applied:', {
                userId,
                trackingNumber: params.B,
                angleDeg: params.angleDeg.toFixed(2),
                zoom: params.zoom.toFixed(3),
                shiftX: params.shiftX.toFixed(1),
                shiftY: params.shiftY.toFixed(1),
            });
        } catch (err) {
            error('Failed to apply fingerprint transform: ' + err.message);
        }
    };

    const downloadUnscrambledImage = () => {
        if (!fingerprintedUrl) {
            error('Please unscramble an image first');
            return;
        }

        // Download the fingerprinted copy — the version unique to this user
        const a = document.createElement('a');
        a.href = fingerprintedUrl;
        a.download = `unscrambled_${selectedFile?.name?.replace(/\.[^/.]+$/, '') || 'image'}_fp.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        success('Fingerprinted image downloaded!');
    };


    const confirmSpendingCredits = () => {


        const LQ = 2;
        const SDcharge = 3;
        const HDcharge = 5;
        const FHDCharge = 10;

        let fileDetails = {
            type: 'image',
            size: selectedFile?.size || 0,
            name: selectedFile?.name || '',
            horizontal: imageRef.current?.naturalWidth || 0,
            vertical: imageRef.current?.naturalHeight || 0
        };

        // Calculate cost based on photo resolution from fileDetails
        const width = fileDetails.horizontal;
        const height = fileDetails.vertical;

        console.log('Photo Dimensions:', width, 'x', height);
        console.log('Photo Size:', fileDetails.size, 'bytes');

        let resolutionCost = LQ;
        if (width >= 1920 && height >= 1080) {
            resolutionCost = FHDCharge;
        } else if (width >= 1280 && height >= 720) {
            resolutionCost = HDcharge;
        } else if (width >= 854 && height >= 480) {
            resolutionCost = SDcharge;
        } else {
            resolutionCost = LQ;
        }

        let calculatedCost = Math.ceil(Math.sqrt(resolutionCost + 1) * (1 + fileDetails.size / (1000 * 1000 * 0.5))); // scale by size in MB over 0.5MB
        const finalCost = Math.ceil(calculatedCost * Math.sqrt(scrambleLevel));
        console.log('Total Cost after scramble level adjustment:', finalCost);
        setActionCost(finalCost);

        // Show credit confirmation modal before scrambling
        setShowCreditModal(true);
        setScrambleLevel(decodedKey.cols >= decodedKey.rows ? decodedKey.cols : decodedKey.rows);

        // onGenerate();
    };


    const handleRefundCredits = async (actionCosts) => {
        // Generate noise seed
        // const nSeed = genRandomSeed();
        // setNoiseSeed(nSeed);

        let cost = 0;

        if (actionCosts != actionCost) {
            cost = parseInt(localStorage.getItem('lastActionCost')) || actionCost;
        } else {
            cost = actionCost;
        }

        const result = await refundCredits({
            userId: userData.id,
            username: userData.username,
            email: userData.email,
            credits: cost,
            currentCredits: userCredits,
            password: localStorage.getItem('hashedPassword'),
            action: 'unscramble_photo_pro',

            params: {

                scrambleLevel: scrambleLevel,
                // grid: { rows, cols },
                row: decodedKey?.rows || null,
                col: decodedKey?.cols || null,
                seed: decodedKey?.seed || null,
                algorithm: decodedKey?.scramble?.algorithm || null,
                percentage: decodedKey?.scramble?.percentage || null,
                scramble: decodedKey?.scramble || null,
                noise: decodedKey?.noise || null,

                metadata: {
                    username: userData.username || 'Anonymous',
                    userId: userData.id || 'Unknown',
                    timestamp: new Date().toISOString()
                },
                type: "photo",
                version: "premium"
            }
        });

        if (result.success) {
            error(`An error occurred during scrambling. ${result.message}`);
        } else {
            error(`Scrambling failed. ${result.message}`);
        }
    };



    // =============================
    // RENDER
    // =============================
    return (
        <Container sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    {/* <LockOpen /> */}
                    🔓 Pro Photo Unscrambler
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Restore scrambled images using your unscramble key
                </Typography>

                {/* Status indicators */}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="Server: localhost:5000" size="small" color="success" />
                    <Chip label="Format: PNG/JPG" size="small" />
                    <Chip label="Pro Features Enabled" size="small" color="primary" />
                </Box>
            </Box>

            {/* Main Unscramble Section */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AutoAwesome />
                        Unscramble Photo (Server-Side)
                    </Typography>

                    {/* Step 1: Upload Scrambled Image */}
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                                Step 1
                            </Typography>
                            <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                                Upload Scrambled Image
                            </Typography>
                        </Box>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            id="image-upload-unscramble"
                            ref={fileInputRef}
                        />
                        <label htmlFor="image-upload-unscramble">
                            <Button
                                variant="contained"
                                component="span"
                                startIcon={<PhotoCamera />}
                                sx={{ backgroundColor: '#2196f3', color: 'white', mb: 1 }}
                            >
                                Choose Scrambled Image
                            </Button>
                        </label>
                        {selectedFile && (
                            <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                                ✓ Selected: {selectedFile.name}
                            </Typography>
                        )}
                    </Box>

                    <Divider sx={{ my: 3, backgroundColor: '#666' }} />

                    {/* Step 2: Paste and Decode Key */}
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                                Step 2
                            </Typography>
                            <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                                Enter Your Unscramble Key
                            </Typography>
                        </Box>

                        <Grid item xs={12} md={6}>
                            {/* <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                                Scramble Key File
                            </Typography> */}
                            <input
                                type="file"
                                accept=".key,.json,.txt"
                                onChange={handleKeyFileSelect}
                                style={{ display: 'none' }}
                                id="key-file-upload"
                                ref={keyFileInputRef}
                            />
                            <label htmlFor="key-file-upload">
                                <Button variant="contained" component="span" startIcon={<Upload />} sx={{ backgroundColor: '#2196f3', color: 'white', mb: 2 }}>
                                    Choose Key File
                                </Button>
                            </label>

                        </Grid>

                        <Typography variant="body2" sx={{ mb: 1, color: '#bdbdbd' }}>
                            Or paste your unscramble key below:
                        </Typography>

                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            value={keyCode}
                            onChange={(e) => setKeyCode(e.target.value)}
                            placeholder="Paste your unscramble key here..."
                            InputProps={{
                                sx: {
                                    fontFamily: 'monospace',
                                    backgroundColor: '#353535',
                                    color: 'white'
                                }
                            }}
                            sx={{ mb: 2 }}
                        />

                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                onClick={decodeKey}
                                startIcon={<VpnKey />}
                                disabled={!keyCode}
                                sx={{ backgroundColor: '#ff9800', color: 'white' }}
                            >
                                Decode Key
                            </Button>

                            {keyValid && decodedKey && (
                                <Chip
                                    icon={<CheckCircle />}
                                    label={`Valid Key`}
                                    color="success"
                                    sx={{ fontWeight: 'bold' }}
                                />
                            )}
                        </Box>



                        {/* Display Decoded Key Info */}
                        {keyValid && decodedKey && (
                            <Alert severity="success" sx={{ mt: 2, backgroundColor: '#2e7d32', color: 'white' }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                    Key Information:
                                </Typography>
                                {/* <Typography variant="body2">
                                    • Algorithm: <strong>{decodedKey.algorithm}</strong>
                                </Typography>
                                <Typography variant="body2">
                                    • Seed: <strong>{decodedKey.seed}</strong>
                                </Typography> */}
                                {decodedKey.rows && (
                                    <Typography variant="body2">
                                        • Grid: <strong>{decodedKey.rows} × {decodedKey.cols}</strong>
                                    </Typography>
                                )}
                                {/* <Typography variant="body2">
                                    • Scrambling: <strong>{decodedKey.percentage}%</strong>
                                </Typography> */}
                                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem', opacity: 0.8 }}>
                                    Created: {new Date(decodedKey.timestamp).toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem', opacity: 0.8 }}>
                                    Expires: {new Date(decodedKey.timestamp + 7 * 24 * 60 * 60 * 1000).toLocaleString()}
                                </Typography>
                                {/* for testing purposes */}
                                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem', opacity: 0.8 }}>
                                    Unscrambles: {Math.floor(Math.random() * 1000)}
                                </Typography>
                            </Alert>
                        )}
                    </Box>

                    <Divider sx={{ my: 3, backgroundColor: '#666' }} />

                    {/* Step 3: Unscramble */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Typography variant="h5" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                                Step 3
                            </Typography>
                            <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                                Unscramble Image
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                // onClick={unscrambleImage}
                                onClick={() => {
                                    confirmSpendingCredits();

                                }}
                                startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudDownload />}
                                disabled={!imageLoaded || !keyValid}
                                sx={{
                                    backgroundColor: (!imageLoaded || !keyValid) ? '#666' : '#22d3ee',
                                    color: (!imageLoaded || !keyValid) ? '#999' : '#001018',
                                    fontWeight: 'bold',
                                    minWidth: '200px'
                                }}
                            >
                                {isProcessing ? 'Processing...' : 'Unscramble on Server'}

                            </Button>

                            <Button
                                variant="contained"
                                onClick={downloadUnscrambledImage}
                                startIcon={<Download />}
                                disabled={!fingerprintedUrl}
                                sx={{ backgroundColor: '#9c27b0', color: 'white' }}
                            >
                                Download Unscrambled Image
                            </Button>
                        </Box>

                        {(!imageLoaded || !keyValid) && (
                            <Alert severity="warning" sx={{ mt: 2, backgroundColor: '#ed6c02', color: 'white' }}>
                                <Typography variant="body2">
                                    {!imageLoaded ? '⚠️ Please upload a scrambled image first' : '⚠️ Please decode your key first'}
                                </Typography>
                            </Alert>
                        )}
                    </Box>

                    {/* Image Comparison */}
                    <Box sx={{ borderTop: '1px solid #666', pt: 3, mt: 3 }}>
                        <Grid container spacing={3}>
                            {/* Scrambled Image */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                                    Scrambled Image (Input)
                                </Typography>
                                <Box sx={{
                                    minHeight: '200px',
                                    backgroundColor: '#0b1020',
                                    border: '1px dashed #666',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden'
                                }}>
                                    {previewUrl ? (
                                        <>
                                            <img
                                                // ref={previewImg}
                                                // ref={imageRef}
                                                src={previewUrl}
                                                alt="Original Preview"
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '400px',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <img
                                                hidden
                                                // ref={previewImg}
                                                ref={imageRef}
                                                src={previewUrl}
                                                alt="Original"
                                                style={{
                                                    display: 'none',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <Typography variant="body2" sx={{ color: '#666' }}>
                                            Select a scrambled image to preview
                                        </Typography>
                                    )}
                                </Box>
                            </Grid>

                            {/* Unscrambled Image */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                                    Unscrambled Image (Fingerprinted)
                                </Typography>
                                <Box sx={{
                                    minHeight: '200px',
                                    backgroundColor: '#0b1020',
                                    border: '1px dashed #666',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden'
                                }}>
                                    {fingerprintedUrl ? (
                                        <img
                                            src={fingerprintedUrl}
                                            alt="Fingerprinted Unscrambled"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '400px',
                                                borderRadius: '8px'
                                            }}
                                        />
                                    ) : unscrambledFilename ? (
                                        // Fingerprint transform still processing
                                        <Typography variant="body2" sx={{ color: '#aaa' }}>
                                            ⏳ Applying fingerprint transform...
                                        </Typography>
                                    ) : (
                                        <Typography variant="body2" sx={{ color: '#666' }}>
                                            Unscrambled image will appear here
                                        </Typography>
                                    )}
                                </Box>
                            </Grid>
                        </Grid>

                        {/* Fingerprint info */}
                        {fingerprintParams && (
                            <Alert severity="info" sx={{ mt: 2, backgroundColor: '#0d2b45', color: '#7dd3fc' }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                    🔏 Distribution Fingerprint Applied
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>
                                    Tracking ID: <strong>{fingerprintParams.B}</strong> &nbsp;|&nbsp;
                                    Rotation: <strong>{fingerprintParams.angleDeg.toFixed(2)}°</strong> &nbsp;|&nbsp;
                                    Zoom: <strong>{fingerprintParams.zoom.toFixed(3)}×</strong> &nbsp;|&nbsp;
                                    Shift: <strong>({fingerprintParams.shiftX.toFixed(1)}, {fingerprintParams.shiftY.toFixed(1)})px</strong>
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '0.72rem', mt: 0.5, opacity: 0.75 }}>
                                    This copy is uniquely transformed for user <strong>{userData?.username}</strong>.
                                    The parameters are derived from their user ID and can be used to identify the source of any leaked image.
                                </Typography>
                            </Alert>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Info Section */}
            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="body2" color="black">
                    💡 <strong>How it works:</strong> Upload your scrambled image and paste the unscramble key
                    you received when the image was scrambled. The server will use the key's parameters to
                    reverse the scrambling process and restore your original image.
                </Typography>
            </Paper>

            {/* Help Section */}
            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd', mt: 2 }}>
                <Typography variant="body2" color="black">
                    🔑 <strong>Lost your key?</strong> Unfortunately, without the unscramble key, the image cannot be restored.
                    The key contains the seed and algorithm parameters required to reverse the scrambling process.
                    Always save your keys securely!
                </Typography>
            </Paper>

            {/* Credit Confirmation Modal */}

            {showCreditModal && <CreditConfirmationModal
                open={showCreditModal}
                onClose={() => setShowCreditModal(false)}
                onConfirm={handleCreditConfirm}
                mediaType="photo"

                scrambleLevel={scrambleLevel}
                currentCredits={userCredits}
                fileName={selectedFile?.name || ''}
                file={selectedFile}
                user={userData}
                isProcessing={false}
                fileDetails={{
                    type: 'image',
                    size: imageFile?.size || 0,
                    name: imageFile?.name || '',
                    horizontal: imageRef.current?.naturalWidth || 0,
                    vertical: imageRef.current?.naturalHeight || 0
                }}
                // actionCost={actionCost}
                actionType="unscramble-photo-pro"
                actionDescription="pro level photo unscrambling"
                height={400}
                width={500}
            />}

            {/* Processing Modal */}
            <ProcessingModal open={isProcessing} mediaType="photo" />
        </Container>
    );
}
