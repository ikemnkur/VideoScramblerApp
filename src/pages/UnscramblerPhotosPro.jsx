// UnscramblerPhotosPro.jsx — Pro Photo Unscrambler with Python Backend
// Connects to Flask server on port 5000 for advanced unscrambling algorithms
// Supports: Position, Color, Rotation, Mirror, and Intensity unscrambling

import React, { useState, useRef, useCallback } from 'react';
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
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:3001/api';
const Flask_API_URL = 'http://localhost:5000/';

export default function UnscramblerPhotosPro() {
    const { success, error } = useToast();

    // Refs
    const fileInputRef = useRef(null);
    const scrambledDisplayRef = useRef(null);
    const unscrambledDisplayRef = useRef(null);

    // State
    const [selectedFile, setSelectedFile] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [unscrambledFilename, setUnscrambledFilename] = useState('');
    const [keyCode, setKeyCode] = useState('');
    const [decodedKey, setDecodedKey] = useState(null);
    const [keyValid, setKeyValid] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');

    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

    const [showCreditModal, setShowCreditModal] = useState(false);
    const [allowScrambling, setAllowScrambling] = useState(false);
    const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
    const SCRAMBLE_COST = 10; // Cost to scramble a photo (less than video)


    const handleCreditConfirm = useCallback(() => {
        setShowCreditModal(false);

        setAllowScrambling(true);

    }, []);

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
        setUnscrambledFilename('');

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setImageLoaded(true);
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

            // Validate key structure
            if (!keyData.algorithm || !keyData.seed) {
                throw new Error("Invalid key format");
            }

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

        if (!allowScrambling) {
            error('You need to confirm credit usage before applying parameters.');
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
                max_intensity_shift: decodedKey.maxIntensityShift
            };

            console.log("Unscrambling with params:", params);

            // Create FormData with file and parameters
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('params', JSON.stringify(params));

            // Call unscramble endpoint
            const response = await fetch(`${API_URL}/unscramble-photo`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Unscrambling failed');
            }

            const data = await response.json();

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
            try {
                setTimeout(() => {
                    info(`Image checked successfully. ${data.creditsUsed} credits spent.`);
                }, timeout);
            } catch (error) {
                console.error('Error showing credit spent info:', error);
            }

        } catch (err) {
            console.error("Unscramble error:", err);
            error("Unscrambling failed: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const loadUnscrambledImage = async (filename) => {
        try {
            const response = await fetch(`${Flask_API_URL}/download/${filename}`);
            if (!response.ok) throw new Error('Failed to load unscrambled image');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (unscrambledDisplayRef.current) {
                unscrambledDisplayRef.current.src = url;
            }
        } catch (err) {
            error("Failed to load unscrambled image: " + err.message);
        }
    };

    const downloadUnscrambledImage = async () => {
        if (!unscrambledFilename) {
            error("Please unscramble an image first");
            return;
        }

        try {
            const response = await fetch(`${Flask_API_URL}/download/${unscrambledFilename}`);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = unscrambledFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            success("Unscrambled image downloaded!");
        } catch (err) {
            error("Download failed: " + err.message);
        }
    };

    useEffect(async () => {

        // const userData = JSON.parse(localStorage.getItem("userdata")  );
        // setUserdata(userData);
        response = await  api.post(`api/wallet/balance/${userData.username}`, {
            username: userData.username,
            email: userData.email,
            password: localStorage.getItem('passwordtxt')
        });

        if (response.status === 200 && response.data) {
            setUserCredits(response.data.credits);
        }
    }, []);

    // =============================
    // RENDER
    // =============================
    return (
        <Container sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <LockOpen />
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
                                    label={`Valid Key: ${decodedKey.algorithm.toUpperCase()} Algorithm`}
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
                                    • Algorithm: <strong>{decodedKey.algorithm.toUpperCase()}</strong>
                                </Typography>
                                <Typography variant="body2">
                                    • Seed: <strong>{decodedKey.seed}</strong>
                                </Typography>
                                {decodedKey.rows && (
                                    <Typography variant="body2">
                                        • Grid: <strong>{decodedKey.rows} × {decodedKey.cols}</strong>
                                    </Typography>
                                )}
                                <Typography variant="body2">
                                    • Scrambling: <strong>{decodedKey.percentage}%</strong>
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem', opacity: 0.8 }}>
                                    Created: {new Date(decodedKey.timestamp).toLocaleString()}
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
                                onClick={unscrambleImage}
                                startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudDownload />}
                                disabled={!imageLoaded || !keyValid || isProcessing}
                                sx={{
                                    backgroundColor: (!imageLoaded || !keyValid || isProcessing) ? '#666' : '#22d3ee',
                                    color: (!imageLoaded || !keyValid || isProcessing) ? '#999' : '#001018',
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
                                        <img
                                            src={previewUrl}
                                            alt="Scrambled"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '400px',
                                                borderRadius: '8px'
                                            }}
                                        />
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
                <Typography variant="body2" color="text.secondary">
                    💡 <strong>How it works:</strong> Upload your scrambled image and paste the unscramble key
                    you received when the image was scrambled. The server will use the key's parameters to
                    reverse the scrambling process and restore your original image.
                </Typography>
            </Paper>

            {/* Help Section */}
            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd', mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    🔑 <strong>Lost your key?</strong> Unfortunately, without the unscramble key, the image cannot be restored.
                    The key contains the seed and algorithm parameters required to reverse the scrambling process.
                    Always save your keys securely!
                </Typography>
            </Paper>

            {/* Credit Confirmation Modal */}
            <CreditConfirmationModal
                open={showCreditModal}
                onClose={() => setShowCreditModal(false)}
                onConfirm={handleCreditConfirm}
                mediaType="photo"
                creditCost={SCRAMBLE_COST}
                currentCredits={userCredits}
                fileName={selectedFile?.name || ''}
                file={selectedFile}
                user={userData}
        isProcessing={false}
            />
        </Container>
    );
}
