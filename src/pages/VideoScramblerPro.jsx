// ScramblerPhotosPro.jsx — Pro Photo Scrambler with Python Backend
// Connects to Flask server on port 5000 for advanced scrambling algorithms
// Supports: Position, Color, Rotation, Mirror, and Intensity scrambling

import React, { useState, useRef } from 'react';
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

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:5000';

export default function ScramblerPhotosPro() {
  const { success, error } = useToast();

  // Refs
  const fileInputRef = useRef(null);
  const displayImageRef = useRef(null);
  const scrambledDisplayRef = useRef(null);

  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [scrambledFilename, setScrambledFilename] = useState('');
  const [keyCode, setKeyCode] = useState('');
  const [currentTab, setCurrentTab] = useState(0);

  const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
  const [allowScrambling, setAllowScrambling] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);

  // Scrambling Parameters
  const [algorithm, setAlgorithm] = useState('position'); // position, color, rotation, mirror, intensity
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000000));
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [scramblingPercentage, setScramblingPercentage] = useState(100);

  // Algorithm-specific parameters
  const [maxHueShift, setMaxHueShift] = useState(64);
  const [maxIntensityShift, setMaxIntensityShift] = useState(128);

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
    setImageLoaded(false);
    setScrambledFilename('');
    setKeyCode('');

    console.log("Selected file:", file);

    const url = URL.createObjectURL(file);
    if (displayImageRef.current) {
      displayImageRef.current.onload = () => {
        setImageLoaded(true);
        URL.revokeObjectURL(url);
      };
      displayImageRef.current.src = url;
    }
  };

  useEffect(async () => {

    const userData = JSON.parse(localStorage.getItem("userdata")  );
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
  // API CALLS
  // =============================
  const uploadFile = async () => {
    if (!selectedFile) {
      error("Please select a file first");
      return null;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadedFilename(data.filename);
      success("File uploaded to server!");
      return data.filename;
    } catch (err) {
      error("Failed to upload file: " + err.message);
      return null;
    }
  };

  const scrambleImage = async () => {
    if (!selectedFile) {
      error("Please select an image first");
      return;
    }

    if (!allowScrambling) {
      error("You need to spend credits to enable scrambling before proceeding");
      return;
    }

    setIsProcessing(true);

    try {
      // First upload the file
      const filename = uploadedFilename || await uploadFile();
      if (!filename) {
        setIsProcessing(false);
        return;
      }

      // Build scramble parameters based on algorithm
      const params = {
        input: filename,
        output: `scrambled_${filename}`,
        seed: seed,
        mode: 'scramble'
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

      // Call scramble endpoint
      const response = await fetch(`${API_URL}/scramble-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error('Scrambling failed');
      }

      const data = await response.json();
      setScrambledFilename(data.output_file);

      // Generate and display key
      const key = {
        algorithm,
        seed,
        rows,
        cols,
        percentage: scramblingPercentage,
        maxHueShift,
        maxIntensityShift,
        timestamp: Date.now()
      };
      const encodedKey = btoa(JSON.stringify(key));
      setKeyCode(encodedKey);

      // Load scrambled image preview
      loadScrambledImage(data.output_file);

      success("Image scrambled successfully!");
    } catch (err) {
      error("Scrambling failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadScrambledImage = async (filename) => {
    try {
      const response = await fetch(`${API_URL}/download/${filename}`);
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
      const response = await fetch(`${API_URL}/download/${scrambledFilename}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = scrambledFilename;
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
    a.download = `unscramble_key_${Date.now()}.txt`;
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

  const handleCreditConfirm = useCallback(() => {
    setShowCreditModal(false);

    setAllowScrambling(true);

  }, []);

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
          <Chip label="Server: localhost:5000" size="small" color="success" />
          <Chip label="Format: PNG/JPG" size="small" />
          <Chip label="Pro Features Enabled" size="small" color="primary" />
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
              {/* Common Parameters */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Seed"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                  InputProps={{
                    sx: { backgroundColor: '#353535', color: 'white' },
                    endAdornment: (
                      <Button size="small" onClick={regenerateSeed} sx={{ color: '#22d3ee' }}>
                        Random
                      </Button>
                    )
                  }}
                  InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 1 }}>
                  Scrambling Percentage: {scramblingPercentage}%
                </Typography>
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
              </Grid>

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
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button
              variant="contained"
              onClick={scrambleImage}
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
                  {imageLoaded ? (
                    <img
                      ref={displayImageRef}
                      alt="Original"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        borderRadius: '8px'
                      }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Select an image to preview
                    </Typography>
                  )}
                </Box>
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
      <CreditConfirmationModal
        open={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onConfirm={handleCreditConfirm}
        mediaType="video"
        creditCost={SCRAMBLE_COST}
        currentCredits={userCredits}
        fileName={selectedFile?.name || ''}
        file={selectedFile}
        isProcessing={false}
      />

      {/* Info Section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
        <Typography variant="body2" color="text.secondary">
          💡 <strong>Pro Version:</strong> This scrambler uses server-side Python processing for advanced algorithms
          including position shuffling, color scrambling, rotation, mirroring, and intensity shifting.
          Configure tile sizes, scrambling percentage, and algorithm-specific parameters for optimal results.
        </Typography>
      </Paper>
    </Container>
  );
}
