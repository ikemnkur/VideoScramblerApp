// ScramblerPhotosPro.jsx — Pro Photo Scrambler with Python Backend
// Connects to Flask server on port 5000 for advanced scrambling algorithms
// Supports: Position, Color, Rotation, Mirror, and Intensity scrambling

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
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Slider,
    CircularProgress,
    Tabs,
    Tab
} from '@mui/material';
import {
    PhotoCamera,
    Shuffle,
    Download,
    ContentCopy,
    Settings,
    CloudUpload,
    AutoAwesome
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';
const Flask_API_URL = import.meta.env.VITE_API_PY_SERVER_URL || 'http://localhost:5000';

export default function PhotoScramblerPro() {
    const { success, error, info } = useToast();


    // Refs
    const imageRef = useRef(null);
    const previewImg = useRef(null);
    const fileInputRef = useRef(null);
    const displayImageRef = useRef(null);
    const scrambledDisplayRef = useRef(null);

    // State
    const [selectedFile, setSelectedFile] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    // const [uploadedFilename, setUploadedFilename] = useState('');
    const [scrambledFilename, setScrambledFilename] = useState('');
    const [keyCode, setKeyCode] = useState('');
    const [currentTab, setCurrentTab] = useState(0);
    const [previewUrl, setPreviewUrl] = useState('');

    const [imageFile, setImageFile] = useState(null);
    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

    const [showCreditModal, setShowCreditModal] = useState(false);
    const [allowScrambling, setAllowScrambling] = useState(false);
    const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
    const [actionCost, setActionCost] = useState(15); // Cost to unscramble a video (pro version)
    const [scrambleLevel, setScrambleLevel] = useState(1); // Level of scrambling (for credit calculation)

    const [shuffleParams, setShuffleParams] = useState(null);
    const [scrambSeed, setScrambSeed] = useState(Math.floor(Math.random() * 1000000000));
    const [perm, setPerm] = useState([]);

    const timeout = 2000; // 2 seconds

    // Scrambling Parameters
    const [algorithm, setAlgorithm] = useState('position'); // position, color, rotation, mirror, intensity
    const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000000));
    const [rows, setRows] = useState(6);
    const [cols, setCols] = useState(6);
    const [scramblingPercentage, setScramblingPercentage] = useState(100);

    // noise seed

    const [noiseIntensity, setNoiseIntensity] = useState(30); // Noise intensity for obscuring the image (0-127)
    const [noiseSeed, setNoiseSeed] = useState(() => genRandomSeed());
    const [noiseTileSize, setNoiseTileSize] = useState(128);

    // Algorithm-specific parameters
    const [maxHueShift, setMaxHueShift] = useState(64);
    const [maxIntensityShift, setMaxIntensityShift] = useState(128);

    // =============================
    // UTILS
    // =============================
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function mulberry32(a) {
        return function () {
            let t = (a += 0x6D2B79F5);
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
        return (Math.floor(Math.random() * 2 ** 32) >>> 0);
    }
    function seededPermutation(size, seed) {
        const rand = mulberry32(seed >>> 0);
        const srcs = Array.from({ length: size }, (_, i) => i);
        for (let i = size - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [srcs[i], srcs[j]] = [srcs[j], srcs[i]];
        }
        return srcs; // dest index i will take from source srcs[i]
    }

    function oneBased(a) { return a.map((x) => x + 1); }

    function gcd(a, b) {
        while (b !== 0) {
            [a, b] = [b, a % b];
        }
        return a;
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

    const handleRefundCredits = async (actionCost) => {
        // Generate noise seed
        // const nSeed = genRandomSeed();
        // setNoiseSeed(nSeed);

        const result = await refundCredits({
            userId: userData.id,
            username: userData.username,
            email: userData.email,
            credits: actionCost,
            currentCredits: userCredits,
            password: localStorage.getItem('passwordtxt'),
            action: 'scramble_photo_pro',
            // params: {
            //     scrambleLevel: scrambleLevel,
            //     grid: { rows, cols },
            //     seed: seed,
            //     algorithm: algorithm,
            //     percentage: scramblingPercentage
            // }
            params: {
                scrambleLevel: scrambleLevel,
                grid: { rows, cols },
                seed: seed,
                algorithm: algorithm,
                percentage: scramblingPercentage,
                scramble: shuffleParams,
                noise: {
                    seed: noiseSeed,
                    intensity: Math.round(noiseIntensity),
                    mode: "add_mod256_tile",
                    prng: "mulberry32"
                },
                metadata: {
                    username: userData.username || 'Anonymous',
                    userId: userData.userId || 'Unknown',
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

    const handleCreditConfirm = useCallback((actualCostSpent) => {
        setShowCreditModal(false);

        setAllowScrambling(true);

        // record parameter for potenaital refund evaluation

        const shuffleParamsObj = {
            version: 2,
            seed: scrambSeed,
            n: rows,
            m: cols,
            perm1based: oneBased(perm),
            semantics: "Index = destination cell (1-based), value = source cell index (1-based)"
        };

        setShuffleParams(shuffleParamsObj);

        // Now you have access to the actual cost that was calculated and spent
        console.log('Credits spent:', actualCostSpent);

        setActionCost(actualCostSpent);

        setTimeout(() => {
            scrambleImage(actionCost);
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
        setImageFile(file); // Also set imageFile for scrambling logic
        setScrambledFilename('');
        setKeyCode('');

        // Reset previous state

        setImageLoaded(true);

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        // Load image into the hidden image ref for processing
        if (imageRef.current) {
            imageRef.current.onload = () => {
                console.log("Image loaded successfully");
                setImageLoaded(true);
                // updateCanvas();
                URL.revokeObjectURL(url);
                // set tile size for noise generation
                setNoiseTileSize(gcd(imageRef.current.naturalWidth, imageRef.current.naturalHeight))
            };

            imageRef.current.onerror = () => {
                console.error("Failed to load image");
                error("Failed to load the selected image");
                setImageLoaded(false);
                URL.revokeObjectURL(url);
            };

            imageRef.current.src = url;
        }

        console.log("Selected file:", file);
    };


    // =============================
    const scrambleImage = useCallback(async (file, actionCost) => {

        console.log("scrambleImage called, selectedFile:", selectedFile);
        // console.log("selected Image File:", localStorage.getItem("selectedImageFile"));
        if (!selectedFile) {
            console.error("No file selected");
            error("Please select an image first");
            return;
        }

        setIsProcessing(true);

        try {
            // Build scramble parameters based on algorithm
            const params = {
                input: selectedFile.name,
                output: `scrambled_${selectedFile.name}`,
                seed: seed,
                mode: 'scramble',
                noise_seed: noiseSeed,
                noise_intensity: Math.round(noiseIntensity),
                noise_tile_size: noiseTileSize,
                noise_mode: "add_mod256_tile",
                prng: "mulberry32"

            };
            // Add algorithm-specific parameters
            switch (algorithm) {
                case 'position':
                    params.algorithm = 'position';
                    params.rows = rows;
                    params.cols = cols;
                    params.percentage = scramblingPercentage;
                    break;
                case 'color':
                    params.algorithm = 'color';
                    params.max_hue_shift = maxHueShift;
                    params.percentage = scramblingPercentage;
                    break;
                case 'rotation':
                    params.algorithm = 'rotation';
                    params.rows = rows;
                    params.cols = cols;
                    params.percentage = scramblingPercentage;
                    break;
                case 'mirror':
                    params.algorithm = 'mirror';
                    params.rows = rows;
                    params.cols = cols;
                    params.percentage = scramblingPercentage;
                    break;
                case 'intensity':
                    params.algorithm = 'intensity';
                    params.max_intensity_shift = maxIntensityShift;
                    params.percentage = scramblingPercentage;
                    break;
            }

            // Create FormData with file and parameters
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('params', JSON.stringify(params));


            try {
                // Call scramble endpoint
                const response = await fetch(`${API_URL}/api/scramble-photo`, {
                    method: 'POST',
                    body: formData
                    // Don't set Content-Type header - browser will set it automatically with boundary
                });

                const data = await response.json();

                console.log("Scramble response:", response);

                if (!response.ok || !data.success) {
                    error("Scrambling failed: " + (data.message || "Unknown error"));
                    setIsProcessing(false);
                    console.log("Scrambling failed, refunding credits: ", actionCost);
                    handleRefundCredits(actionCost);
                    return;
                }

                // The backend should return the scrambled image info
                setScrambledFilename(data.output_file || data.scrambledFileName);

                // Generate and display key
                const key = {
                    algorithm,
                    seed,
                    rows,
                    cols,
                    percentage: scramblingPercentage,
                    maxHueShift,
                    maxIntensityShift,
                    timestamp: Date.now(),
                    username: userData.username || 'Anonymous',
                    userId: userData.userId || 'Unknown',
                    type: "photo",
                    version: "premium",
                    scramble: {
                        algorithm,
                        seed,
                        rows,
                        cols,
                        percentage: scramblingPercentage,
                        maxHueShift,
                        maxIntensityShift
                    },
                    noise: {
                        seed: noiseSeed,
                        intensity: Math.round(noiseIntensity),
                        mode: "add_mod256_tile",
                        prng: "mulberry32"
                    },
                };

                const encodedKey = btoa(JSON.stringify(key));
                setKeyCode(encodedKey);

                // Load scrambled image preview
                if (data.output_file || data.scrambledFileName) {
                    loadScrambledImage(data.output_file || data.scrambledFileName);
                } else if (data.scrambledImageUrl) {
                    // If backend returns direct URL
                    if (scrambledDisplayRef.current) {
                        scrambledDisplayRef.current.src = data.scrambledImageUrl;
                    }
                }

                success("Image scrambled successfully!");

                // SHOW MESSAGE DIALOG SAYTHING THAT THE USER HAS SPENT CREDITS TO CHECK THE IMAGE
                try {
                    setTimeout(() => {
                        info(`Image checked successfully. ${data.creditsUsed} credits spent.`);
                    }, timeout);
                } catch (error) {
                    console.error('Error showing credit spent info:', error);
                }

            } catch (error) {
                // TODO: Refund credits if applicable

                handleRefundCredits();

                throw new Error(data.error || data.message || 'Scrambling failed');
            }

        } catch (err) {
            console.error("Scramble error:", err);
            error("Scrambling failed: " + err.message);
        } finally {
            setIsProcessing(false);
        }

    }, [selectedFile, algorithm, seed, rows, cols, scramblingPercentage, maxHueShift, maxIntensityShift, error, userData]);

    const loadScrambledImage = async (filename) => {
        try {
            const response = await fetch(`${Flask_API_URL}/download/${filename}`);
            if (!response.ok) throw new Error('Failed to load scrambled image');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (scrambledDisplayRef.current) {
                scrambledDisplayRef.current.src = url;
            }
        } catch (err) {
            error("Failed to load scrambled image: " + err.message);
        }
    };

    const downloadScrambledImage = async () => {
        if (!scrambledFilename) {
            error("Please scramble an image first");
            return;
        }

        try {
            const response = await fetch(`${Flask_API_URL}/download/${scrambledFilename}`);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            let tempname = selectedFile?.name
                ? selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[^\w\-. ]+/g, '').replace(/\s+/g, '_')
                : 'video' + timestamp();//selectedFile.name.replace (/\.[^/.]+$/, ""); // remove extension
            a.download = `scrambled_${tempname}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            success("Scrambled image downloaded!");
        } catch (err) {
            error("Download failed: " + err.message);
        }
    };

    // =============================
    // KEY MANAGEMENT
    // =============================
    const copyKey = async () => {
        if (!keyCode) {
            error("Please scramble an image first");
            return;
        }
        try {
            await navigator.clipboard.writeText(keyCode);
            success("Key copied to clipboard!");
        } catch {
            error("Failed to copy key");
        }
    };

    const downloadKey = () => {
        if (!keyCode) {
            error("Please scramble an image first");
            return;
        }
        const blob = new Blob([keyCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unscramble_key_${selectedFile?.name || 'unknown'}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        success("Key downloaded!");
    };

    const regenerateSeed = () => {
        setSeed(Math.floor(Math.random() * 1000000000));
        success("New seed generated!");
    };

    // =============================
    // RENDER
    // =============================
    return (
        <Container sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <AutoAwesome />
                    🚀 Pro Photo Scrambler
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Advanced server-side scrambling with multiple algorithms
                </Typography>

                {/* Status indicators */}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="Server Based" size="small" color="success" />
                    <Chip label="Format: PNG/JPG" size="small" />
                    <Chip label="HD/FHD" size="small" color="primary" />
                </Box>
            </Box>

            {/* Main Scramble Section */}
            <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Shuffle />
                        Scramble Photo (Server-Side)
                    </Typography>

                    {/* File Upload */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                            Select Image File
                        </Typography>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            id="image-upload-pro"
                            ref={fileInputRef}
                        />
                        <label htmlFor="image-upload-pro">
                            <Button
                                variant="contained"
                                component="span"
                                startIcon={<PhotoCamera />}
                                sx={{ backgroundColor: '#2196f3', color: 'white', mb: 1 }}
                            >
                                Choose Image File
                            </Button>
                        </label>
                        {selectedFile && (
                            <Typography variant="body2" sx={{ color: '#4caf50', mt: 1 }}>
                                Selected: {selectedFile.name}
                            </Typography>
                        )}
                    </Box>

                    {/* Algorithm Selection */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#e0e0e0' }}>
                            Scrambling Algorithm
                        </Typography>

                        <Tabs
                            value={currentTab}
                            onChange={(e, val) => setCurrentTab(val)}
                            sx={{ mb: 2, borderBottom: '1px solid #666' }}
                        >
                            <Tab label="Position" onClick={() => setAlgorithm('position')} />
                            <Tab label="Color" onClick={() => setAlgorithm('color')} />
                            <Tab label="Rotation" onClick={() => setAlgorithm('rotation')} />
                            <Tab label="Mirror" onClick={() => setAlgorithm('mirror')} />
                            <Tab label="Intensity" onClick={() => setAlgorithm('intensity')} />
                        </Tabs>

                        {/* Algorithm Parameters */}
                        <Grid container spacing={2}>




                            {/* Position, Rotation, Mirror - need rows/cols */}
                            {(algorithm === 'position' || algorithm === 'rotation' || algorithm === 'mirror') && (
                                <>
                                    <Grid item xs={6} md={3}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            label="Rows"
                                            value={rows}
                                            onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                                            inputProps={{ min: 1, max: 20 }}
                                            InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                            InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            label="Columns"
                                            value={cols}
                                            onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                                            inputProps={{ min: 1, max: 20 }}
                                            InputProps={{ sx: { backgroundColor: '#353535', color: 'white' } }}
                                            InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                                        />
                                    </Grid>
                                </>
                            )}

                            {/* Color - needs hue shift */}
                            {algorithm === 'color' && (
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 1 }}>
                                        Max Hue Shift: {maxHueShift}
                                    </Typography>
                                    <Slider
                                        value={maxHueShift}
                                        onChange={(e, val) => setMaxHueShift(val)}
                                        min={16}
                                        max={180}
                                        step={8}
                                        marks={[
                                            { value: 16, label: '16' },
                                            { value: 64, label: '64' },
                                            { value: 128, label: '128' },
                                            { value: 180, label: '180' }
                                        ]}
                                        sx={{ color: '#22d3ee' }}
                                    />
                                </Grid>
                            )}

                            {/* Intensity - needs intensity shift */}
                            {algorithm === 'intensity' && (
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 1 }}>
                                        Max Intensity Shift: {maxIntensityShift}
                                    </Typography>
                                    <Slider
                                        value={maxIntensityShift}
                                        onChange={(e, val) => setMaxIntensityShift(val)}
                                        min={32}
                                        max={255}
                                        step={8}
                                        marks={[
                                            { value: 32, label: '32' },
                                            { value: 128, label: '128' },
                                            { value: 192, label: '192' },
                                            { value: 255, label: '255' }
                                        ]}
                                        sx={{ color: '#22d3ee' }}
                                    />
                                </Grid>
                            )}
                        </Grid>

                        <Grid>

                            {/* Algorithm Descriptions */}
                            <Alert severity="info" sx={{ mt: 2, backgroundColor: '#1976d2', color: 'white' }}>
                                <strong>{algorithm.toUpperCase()}</strong>: {
                                    algorithm === 'position' ? 'Scrambles by shuffling tile positions in a grid' :
                                        algorithm === 'color' ? 'Scrambles by shifting hue values in HSV color space' :
                                            algorithm === 'rotation' ? 'Scrambles by randomly rotating tiles (90°, 180°, 270°)' :
                                                algorithm === 'mirror' ? 'Scrambles by randomly flipping tiles horizontally/vertically' :
                                                    'Scrambles by shifting pixel intensity values'
                                }
                            </Alert>
                            <br></br>
                        </Grid>

                        <Grid item xs={12} md={6} sx={{ mt: 2 }}>
                            <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                                Scrambling Percentage: {scramblingPercentage}%
                            </Typography>
                            <Box m={3}>
                                <Slider
                                    value={scramblingPercentage}
                                    onChange={(e, val) => setScramblingPercentage(val)}
                                    min={25}
                                    max={100}
                                    step={5}
                                    marks={[
                                        { value: 25, label: '25%' },
                                        { value: 50, label: '50%' },
                                        { value: 75, label: '75%' },
                                        { value: 100, label: '100%' }
                                    ]}
                                    sx={{ color: '#22d3ee' }}
                                />
                            </Box>

                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                                Scramble Noise Intensity
                            </Typography>

                            <Box>
                                <Typography variant="body2" sx={{ mb: 1, color: '#bdbdbd' }}>
                                    Noise intensity (max abs per channel)
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => setNoiseIntensity(Math.max(0, noiseIntensity - 1))}
                                        disabled={scrambledFilename !== ''}
                                        sx={{
                                            minWidth: '40px',
                                            borderColor: scrambledFilename !== '' ? '#444' : '#666',
                                            color: scrambledFilename !== '' ? '#666' : '#e0e0e0'
                                        }}
                                    >
                                        −
                                    </Button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="127"
                                        value={noiseIntensity}
                                        onChange={(e) => setNoiseIntensity(Number(e.target.value))}
                                        disabled={scrambledFilename !== ''}
                                        style={{
                                            flex: 1,
                                            opacity: scrambledFilename !== '' ? 0.5 : 1,
                                            cursor: scrambledFilename !== '' ? 'not-allowed' : 'pointer'
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        onClick={() => setNoiseIntensity(Math.min(127, noiseIntensity + 1))}
                                        disabled={scrambledFilename !== ''}
                                        sx={{
                                            minWidth: '40px',
                                            borderColor: scrambledFilename !== '' ? '#444' : '#666',
                                            color: scrambledFilename !== '' ? '#666' : '#e0e0e0'
                                        }}
                                    >
                                        +
                                    </Button>
                                    <TextField
                                        type="number"
                                        value={noiseIntensity}
                                        onChange={(e) => setNoiseIntensity(Number(e.target.value))}
                                        disabled={scrambledFilename !== ''}
                                        inputProps={{ min: 0, max: 127 }}
                                        sx={{
                                            width: '80px',
                                            '& .MuiInputBase-root': {
                                                backgroundColor: scrambledFilename !== '' ? '#252525' : '#353535',
                                                color: scrambledFilename !== '' ? '#666' : 'white'
                                            }
                                        }}
                                    />
                                </Box>
                            </Box>
                            {/* Todo: fix noise preview */}
                            {/* <div class="canvRow">
                                            <div>
                                              <label>Regenerated noise tile preview</label>
                                              <canvas id="cvNoiseTile2" style={{height: 128 , width: 128}}></canvas>
                                            </div>
                                          </div> */}
                            {/* <Typography variant="body2" sx={{ color: '#bdbdbd', mt: 1 }}>
                                    Higher levels create more pieces, making unscrambling more complex.
                                </Typography> */}
                        </Grid>
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>

                        <Button
                            variant="contained"
                            onClick={() => {
                                setShowCreditModal(true);
                                setScrambleLevel(cols >= rows ? cols : rows);
                            }}
                            startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudUpload />}
                            disabled={!imageLoaded || isProcessing}
                            sx={{
                                backgroundColor: (!imageLoaded || isProcessing) ? '#666' : '#22d3ee',
                                color: (!imageLoaded || isProcessing) ? '#999' : '#001018',
                                fontWeight: 'bold'
                            }}
                        >
                            {isProcessing ? 'Processing...' : 'Scramble on Server'}
                        </Button>

                        <Button
                            variant="contained"
                            onClick={downloadScrambledImage}
                            startIcon={<Download />}
                            disabled={!scrambledFilename}
                            sx={{ backgroundColor: '#9c27b0', color: 'white' }}
                        >
                            Download Scrambled Image
                        </Button>
                    </Box>

                    {/* Image Comparison */}
                    <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
                        <Grid container spacing={3}>
                            {/* Original Image */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                                    Original Image
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
                                            Select an image to preview
                                        </Typography>
                                    )}

                                </Box>
                                {imageLoaded && (
                                    <Typography variant="caption" sx={{ color: '#4caf50', mt: 1, display: 'block' }}>
                                        Image loaded: {imageRef.current?.naturalWidth}×{imageRef.current?.naturalHeight}px
                                    </Typography>
                                )}
                            </Grid>

                            {/* Scrambled Image */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                                    Scrambled Image Preview
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
                                    {scrambledFilename ? (
                                        <img
                                            ref={scrambledDisplayRef}
                                            alt="Scrambled"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '400px',
                                                borderRadius: '8px'
                                            }}
                                        />
                                    ) : (
                                        <Typography variant="body2" sx={{ color: '#666' }}>
                                            Scrambled image will appear here
                                        </Typography>
                                    )}
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Key Section */}
                    <Box sx={{ borderTop: '1px solid #666', pt: 3, mt: 3 }}>
                        <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                            Unscramble Key
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            value={keyCode}
                            placeholder="Your unscramble key will appear here after scrambling..."
                            InputProps={{
                                readOnly: true,
                                sx: {
                                    fontFamily: 'monospace',
                                    backgroundColor: '#353535',
                                    color: 'white'
                                }
                            }}
                            sx={{ mb: 2 }}
                        />

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                onClick={downloadKey}
                                startIcon={<Download />}
                                disabled={!keyCode}
                                sx={{ backgroundColor: '#22d3ee', color: '#001018' }}
                            >
                                Download Key
                            </Button>

                            <Button
                                variant="outlined"
                                onClick={copyKey}
                                startIcon={<ContentCopy />}
                                disabled={!keyCode}
                                sx={{ borderColor: '#666', color: '#e0e0e0' }}
                            >
                                Copy Key
                            </Button>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Credit Confirmation Modal */}
            {showCreditModal &&
                <CreditConfirmationModal
                    open={showCreditModal}
                    onClose={() => setShowCreditModal(false)}
                    onConfirm={handleCreditConfirm}
                    mediaType="photo"

                    scrambleLevel={scrambleLevel}
                    currentCredits={userCredits}

                    file={selectedFile}
                    fileName={selectedFile?.name || ''}
                    fileDetails={{
                        type: 'image',
                        size: imageFile?.size || 0,
                        name: imageFile?.name || '',
                        horizontal: imageRef.current?.naturalWidth || 0,
                        vertical: imageRef.current?.naturalHeight || 0
                    }}

                    user={userData}
                    isProcessing={false}

                    actionType="scramble-photo-pro"
                    actionDescription="pro photo scrambling"
                    height={600}
                    width={500}
                />}

            {/* Processing Modal */}
            <ProcessingModal open={isProcessing} mediaType="photo" />

            {/* Info Section */}
            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="body2" color="black">
                    💡 <strong>Pro Version:</strong> This scrambler uses server-side Python processing for advanced algorithms
                    including position shuffling, color scrambling, rotation, mirroring, and intensity shifting.
                    Configure tile sizes, scrambling percentage, and algorithm-specific parameters for optimal results.
                </Typography>
            </Paper>
        </Container>
    );
}
