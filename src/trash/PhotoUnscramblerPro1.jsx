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
    Error as ErrorIcon
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';
const Flask_API_URL = import.meta.env.VITE_API_PY_SERVER_URL || 'http://localhost:5000/';

export default function PhotoUnscramblerPro() {
    const { success, error } = useToast();

    // Refs
    const imageRef = useRef(null);
    const previewImg = useRef(null);
    const fileInputRef = useRef(null);
    const scrambledDisplayRef = useRef(null);
    const unscrambledDisplayRef = useRef(null);

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

    // =============================
    // NOISE UTILITY FUNCTIONS
    // =============================
    function gcd(a, b) {
        a = Math.abs(a | 0); b = Math.abs(b | 0);
        while (b !== 0) { const t = a % b; a = b; b = t; }
        return a;
    }

    function mod(n, m) {
        // true mathematical modulo for negatives
        return ((n % m) + m) % m;
    }

    // Mulberry32 PRNG (seeded, fast, deterministic)
    function mulberry32(seed) {
        let t = seed >>> 0;
        return function () {
            t += 0x6D2B79F5;
            let x = Math.imul(t ^ (t >>> 15), 1 | t);
            x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296; // [0,1)
        };
    }

    function clampInt(n, lo, hi) {
        n = Number(n);
        if (!Number.isFinite(n)) n = lo;
        return Math.max(lo, Math.min(hi, Math.round(n)));
    }

    /* =========================
     Noise generation (tileable)
     - offsets are integers in [-intensity, +intensity]
     - tile is square: tile x tile
    ========================= */
    function generateNoiseTileOffsets(tileSize, seed, intensity) {
        const rand = mulberry32(seed >>> 0);
        const pxCount = tileSize * tileSize;

        // store offsets per pixel per channel (RGB), Int16 is plenty
        const offsets = new Int16Array(pxCount * 3);

        for (let p = 0; p < pxCount; p++) {
            const base = p * 3;
            // Uniform integer in [-intensity, +intensity]
            offsets[base + 0] = Math.round((rand() * 2 - 1) * intensity);
            offsets[base + 1] = Math.round((rand() * 2 - 1) * intensity);
            offsets[base + 2] = Math.round((rand() * 2 - 1) * intensity);
        }
        return offsets;
    }

    function applyNoiseSubMod256(imageData, tileOffsets, tileSize) {
        const w = imageData.width, h = imageData.height;
        const src = imageData.data;
        const out = new Uint8ClampedArray(src); // copy

        for (let y = 0; y < h; y++) {
            const ty = y % tileSize;
            for (let x = 0; x < w; x++) {
                const tx = x % tileSize;
                const tileIndex = (ty * tileSize + tx) * 3;
                const i = (y * w + x) * 4;

                out[i + 0] = mod(src[i + 0] - tileOffsets[tileIndex + 0], 256);
                out[i + 1] = mod(src[i + 1] - tileOffsets[tileIndex + 1], 256);
                out[i + 2] = mod(src[i + 2] - tileOffsets[tileIndex + 2], 256);
            }
        }
        return new ImageData(out, w, h);
    }

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
        // setLastCreditCost(actualCostSpent);
        // setActionCost(actualCostSpent);



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
    const decodeKey = () => {
        if (!keyCode || keyCode.trim() === '') {
            error("Please paste your unscramble key first");
            return;
        }

        try {
            // Decode base64 key
            const jsonString = atob(keyCode.trim());
            const keyData = JSON.parse(jsonString);

            console.log("Raw decoded key data:", JSON.stringify(keyData));


            if (keyData.metadata.type !== "photo") {
                console.error("Invalid key type:", keyData.metadata.type);
                error('The loaded key file is not a valid photo scramble key.');
                throw new Error("Invalid key format");
            } else if (keyData.metadata.version !== "premium") {
                console.log("Invalid key version:", keyData.metadata.version);
                error('Use the ' + keyData.metadata.version + ' ' + keyData.metadata.type + ' unscrambler to unscramble this file.');
                alert('The loaded key file will not work with this unscrambler version, you must use the ' + keyData.metadata.version + ' ' + keyData.metadata.type + ' unscrambler to unscramble this file.');
                throw new Error("Invalid key format");
            }
            //  // Validate key structure
            // if (!keyData.scramble.algorithm || !keyData.scramble.seed) {
            //     throw new Error("Invalid key format");
            // }

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
            return;
        }

        if (!decodedKey || !keyValid) {
            error("Please decode your key first");
            return;
        }

        setIsProcessing(true);

        try {
            // Build unscramble parameters from decoded key
            // Handle both nested and flat key formats
            let scrambleData = decodedKey.scramble || decodedKey;
            let noiseData = decodedKey.noise || null;
            let metadata = decodedKey.metadata || null;

            // const params = {
            //     input: selectedFile.name,
            //     output: `unscrambled_${selectedFile.name}`,
            //     seed: scrambleData.seed ?? decodedKey.seed,
            //     mode: 'unscramble',
            //     algorithm: scrambleData.algorithm ?? decodedKey.algorithm,
            //     rows: scrambleData.rows ?? decodedKey.rows,
            //     cols: scrambleData.cols ?? decodedKey.cols,
            //     percentage: scrambleData.percentage ?? decodedKey.percentage,
            //     max_hue_shift: scrambleData.max_hue_shift ?? decodedKey.maxHueShift ?? decodedKey.maxHueShift,
            //     max_intensity_shift: scrambleData.max_intensity_shift ?? decodedKey.maxIntensityShift ?? decodedKey.maxIntensityShift
            // };

            const params = {
                input: selectedFile.name,
                output: `unscrambled_${selectedFile.name}`,
                seed: scrambleData.seed ?? decodedKey.seed,
                mode: 'unscramble',
                algorithm: scrambleData.algorithm ?? decodedKey.algorithm,
                rows: scrambleData.rows ?? decodedKey.rows,
                cols: scrambleData.cols ?? decodedKey.cols,
                percentage: scrambleData.percentage ?? decodedKey.percentage,
                max_hue_shift: scrambleData.max_hue_shift ?? scrambleData.maxHueShift ?? decodedKey.maxHueShift,
                max_intensity_shift: scrambleData.max_intensity_shift ?? scrambleData.maxIntensityShift ?? decodedKey.maxIntensityShift
            };


            setScrambleLevel(params.cols >= params.rows ? params.cols : params.rows);

            console.log("Unscrambling with params:", params);
            if (noiseData) {
                console.log("Noise parameters detected in key:", noiseData);
            }

            // Create FormData with file and parameters
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('params', JSON.stringify(params));

            try {
                // Call unscramble endpoint
                const response = await fetch(`${API_URL}/api/unscramble-photo`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                console.log("Unscramble response:", data);

                if (!response.ok || !data.success) {
                    error("Unscrambling failed: " + (data.message || "Unknown error"));
                    setIsProcessing(false);
                    handleRefundCredits();
                    return;
                }


                // The backend should return the unscrambled image info
                setUnscrambledFilename(data.output_file || data.unscrambledFileName);

                // Load unscrambled image preview WITH noise parameters for removal
                if (data.output_file || data.unscrambledFileName) {
                    // Pass noise parameters to loadUnscrambledImage
                    loadUnscrambledImage(data.output_file || data.unscrambledFileName, noiseData || data.noise);
                } else if (data.unscrambledImageUrl) {
                    // If backend returns direct URL
                    if (unscrambledDisplayRef.current) {
                        // Create an image element to load and process
                        const img = new Image();
                        img.onload = () => {
                            if (noiseData || data.noise) {
                                removeNoiseFromImage(img, noiseData || data.noise);
                            } else {
                                unscrambledDisplayRef.current.src = data.unscrambledImageUrl;
                            }
                        };
                        img.src = data.unscrambledImageUrl;
                    }
                }

                success("Image unscrambled successfully!");

                // SHOW MESSAGE DIALOG SAYTHING THAT THE USER HAS SPENT CREDITS TO CHECK THE IMAGE
                // try {
                //     setTimeout(() => {
                //         info(`Image checked successfully. ${data.creditsUsed} credits spent.`);
                //     }, timeout);
                // } catch (error) {
                //     console.error('Error showing credit spent info:', error);
                // }


            } catch (error) {
                // const errorData = await response.json().catch(() => ({}));
                // TODO: Refund credits if applicable
                const response = await fetch(`${API_URL}/api/refund-credits`, {
                    method: 'POST',
                    // headers: {
                    //   'Content-Type': 'application/json'
                    // },

                    body: {
                        userId: userData.id,
                        username: userData.username,
                        email: userData.email,
                        password: localStorage.getItem('passwordtxt'),
                        credits: actionCost,
                        params: params,
                    }

                });

                console.log("Refund response:", response);
                throw new Error(errorData.error || 'Unscrambling failed');
                // throw new Error(data.error || data.message || 'Scrambling failed');
            }

        } catch (err) {
            console.error("Unscramble error:", err);
            error("Unscrambling failed: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const loadUnscrambledImage = async (filename, noiseParams = null) => {
        try {
            const response = await fetch(`${Flask_API_URL}/download/${filename}`);
            if (!response.ok) throw new Error('Failed to load unscrambled image');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            // Load the unscrambled image from Flask
            const img = new Image();
            img.onload = () => {
                if (unscrambledDisplayRef.current) {
                    // If there are noise parameters, remove noise from the image
                    if (noiseParams && noiseParams.intensity > 0) {
                        removeNoiseFromImage(img, noiseParams);
                    } else {
                        // No noise to remove, just display the image
                        unscrambledDisplayRef.current.src = url;
                    }
                }
                URL.revokeObjectURL(url);
            };
            img.onerror = () => {
                error("Failed to load unscrambled image");
                URL.revokeObjectURL(url);
            };
            img.src = url;
        } catch (err) {
            error("Failed to load unscrambled image: " + err.message);
        }
    };

    const removeNoiseFromImage = (img, noiseParams) => {
        try {
            if (!noiseParams || !noiseParams.seed || noiseParams.intensity === undefined) {
                console.log("No noise parameters found, skipping noise removal");
                // Just display the image as-is
                if (unscrambledDisplayRef.current) {
                    unscrambledDisplayRef.current.src = img.src;
                }
                return;
            }

            const intensity = clampInt(noiseParams.intensity, 0, 127);
            if (intensity === 0) {
                console.log("Noise intensity is 0, skipping noise removal");
                if (unscrambledDisplayRef.current) {
                    unscrambledDisplayRef.current.src = img.src;
                }
                return;
            }

            const noiseSeed = Number(noiseParams.seed) >>> 0;
            console.log("Removing noise with parameters:", { seed: noiseSeed, intensity });

            // Create a canvas to process the image
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Draw the unscrambled image to canvas
            ctx.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Calculate tile size
            const tile = gcd(canvas.width, canvas.height);
            if (tile <= 0) {
                throw new Error("Invalid tile size computed");
            }

            console.log("Tile size for noise removal:", tile);

            // Regenerate the same tile offsets used during scrambling
            const tileOffsets = generateNoiseTileOffsets(tile, noiseSeed, intensity);

            // Apply reverse noise (subtract mod 256)
            const restoredImageData = applyNoiseSubMod256(imageData, tileOffsets, tile);

            // Put the restored (denoised) image data back to canvas
            ctx.putImageData(restoredImageData, 0, 0);

            // Convert canvas to blob and display
            canvas.toBlob((blob) => {
                if (blob && unscrambledDisplayRef.current) {
                    const denoisedUrl = URL.createObjectURL(blob);
                    unscrambledDisplayRef.current.src = denoisedUrl;
                    console.log("Noise removed successfully");
                    success("Noise removed from unscrambled image");
                }
            }, 'image/png');

            // set Unscrambled Image (Output) imagedata to ctx imagedata
            unscrambledDisplayRef.current.src = canvas.toDataURL();



        } catch (err) {
            console.error("Error removing noise:", err);
            error("Failed to remove noise: " + err.message);
            // Fall back to displaying the image as-is
            if (unscrambledDisplayRef.current && img.src) {
                unscrambledDisplayRef.current.src = img.src;
            }
        }
    };

    const downloadUnscrambledImage = async () => {
        if (!unscrambledFilename) {
            error("Please unscramble an image first");
            return;
        }

        // dowload the image data from unscrambledDisplayRef img src

        //  const blob = await response.blob();
        const blob = await fetch(unscrambledDisplayRef.current.src).then(res => res.blob());
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = unscrambledFilename + "-unscrambled.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        success("Unscrambled image downloaded!");


        // try {
        //     const response = await fetch(`${Flask_API_URL}/download/${unscrambledFilename}`);
        //     if (!response.ok) throw new Error('Download failed');

        //     const blob = await response.blob();
        //     const url = URL.createObjectURL(blob);
        //     const a = document.createElement('a');
        //     a.href = url;
        //     a.download = unscrambledFilename;
        //     document.body.appendChild(a);
        //     a.click();
        //     document.body.removeChild(a);
        //     URL.revokeObjectURL(url);

        //     success("Unscrambled image downloaded!");
        // } catch (err) {
        //     error("Download failed: " + err.message);
        // }
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
                                Paste Your Unscramble Key
                            </Typography>
                        </Box>

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
                                    label={`Valid Key: ${decodedKey.scramble.algorithm} Algorithm`}
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
                                <Typography variant="body2">
                                    • Algorithm: <strong>{decodedKey.scramble.algorithm}</strong>
                                </Typography>
                                <Typography variant="body2">
                                    • Seed: <strong>{decodedKey.scramble.seed}</strong>
                                </Typography>
                                {decodedKey.scramble.rows && (
                                    <Typography variant="body2">
                                        • Grid: <strong>{decodedKey.scramble.rows} × {decodedKey.scramble.cols}</strong>
                                    </Typography>
                                )}
                                <Typography variant="body2">
                                    • Scrambling: <strong>{decodedKey.scramble.percentage}%</strong>
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem', opacity: 0.8 }}>
                                    Created: {new Date(decodedKey.metadata.timestamp).toLocaleString()}
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

                                    setScrambleLevel(decodedKey.scramble.cols >= decodedKey.scramble.rows ? decodedKey.scramble.cols : decodedKey.scramble.rows);
                                    setShowCreditModal(true);

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
                                disabled={!unscrambledFilename}
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
                                    Unscrambled Image (Output)
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
                                    {unscrambledFilename ? (
                                        <img
                                            ref={unscrambledDisplayRef}
                                            alt="Unscrambled"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '400px',
                                                borderRadius: '8px'
                                            }}
                                        />
                                    ) : (
                                        <Typography variant="body2" sx={{ color: '#666' }}>
                                            Unscrambled image will appear here
                                        </Typography>
                                    )}
                                </Box>
                            </Grid>
                        </Grid>
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
            {showCreditModal && (
                <CreditConfirmationModal
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
                />
            )}
        </Container>
    );
}
