// ScramblerVideosPro.jsx — Pro Video Scrambler with Python Backend
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
import { replace } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; // = 'http://localhost:5000';
const Flask_API_URL = import.meta.env.VITE_API_PY_SERVER_URL || 'http://localhost:5000';


export default function ScramblerVideosPro() {
  const { success, error } = useToast();

  // Refs
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const displayVideoRef = useRef(null);
  const scrambledVideoRef = useRef(null);

  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [scrambledFilename, setScrambledFilename] = useState('');
  const [keyCode, setKeyCode] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));

  const [userCredits, setUserCredits] = useState(0); // Mock credits, replace with actual user data
  const [allowScrambling, setAllowScrambling] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [actionCost, setActionCost] = useState(15); // Cost to unscramble a video (less than video)
  const [scrambleLevel, setScrambleLevel] = useState(6); // 'lite' or 'pro'

  // Scrambling Parameters
  const [algorithm, setAlgorithm] = useState('position'); // position, color, rotation, mirror, intensity
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000000));
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [scramblingPercentage, setScramblingPercentage] = useState(100);

  // Algorithm-specific parameters
  const [maxHueShift, setMaxHueShift] = useState(64);
  const [maxIntensityShift, setMaxIntensityShift] = useState(128);




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
  }, []);


  useEffect(() => {

    console.log("parameters have changed")

  }, [rows, cols, algorithm, maxHueShift, maxIntensityShift, scramblingPercentage]);




  // =============================
  // FILE HANDLING
  // =============================
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      error("Please select a valid video file");
      return;
    }

    setSelectedFile(file);
    setVideoLoaded(false);
    setScrambledFilename('');
    setKeyCode('');

    // console.log("Selected file:", file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    if (displayVideoRef.current) {
      displayVideoRef.current.onloadedmetadata = () => {
        setVideoLoaded(true);
      };
      displayVideoRef.current.src = url;
    }

    setVideoLoaded(true);

    success("Video file loaded successfully!");

    console.log("Selected file:", file);
  };


  // =============================
  // KEY MANAGEMENT
  // =============================
  const copyKey = async () => {
    if (!keyCode) {
      error("Please scramble an video first");
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
      error("Please scramble an video first");
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




  const scrambleVideo = useCallback(async () => {
    console.log("scrambleVideo called with current state:", {
      rows, cols, algorithm, seed, maxHueShift, maxIntensityShift, scramblingPercentage
    });

    if (!selectedFile) {
      console.error("No file selected");
      error("Please select a video first");
      return;
    }

    setIsProcessing(true);

    try {
      // Build scramble parameters based on algorithm with current state values
      const params = {
        input: selectedFile.name,
        output: `scrambled_${selectedFile.name}`,
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

      console.log("Scrambling with params:", params);

      // Create FormData with file and parameters
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('params', JSON.stringify(params));

      try {
        // Call scramble endpoint
        const response = await fetch(`${API_URL}/api/scramble-video`, {
          method: 'POST',
          // headers: {
          //   'Content-Type': 'application/json'
          // },
          body: formData
        });
        const data = await response.json();
        console.log("Scramble response data:", data);

        if (!response.ok || !data.success) {
          error("Scrambling failed: " + (data.message || "Unknown error"));
          setIsProcessing(false);
          handleRefundCredits();
          return;
        }

        let tempFileName = data.output_file || data.scrambledFileName;

        if (tempFileName.includes("mp4")) {
          // if  "mp4" is the extenstion in the URL, change it to webm
          if (tempFileName.endsWith("mp4")) {
            tempFileName = tempFileName.replace("mp4", "webm");
          }
        }

        // The backend should return the scrambled video info
        setScrambledFilename(tempFileName);

        console.log("Scrambled file:", tempFileName);


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
          userId: userData.userId || 'Unknown'
        };

        const encodedKey = btoa(JSON.stringify(key));
        setKeyCode(encodedKey);

        // Load scrambled video preview
        loadScrambledVideo();

        success("Video scrambled successfully!");
        
      } catch (err) {
        error("Scrambling failed: " + err.message);
        setIsProcessing(false);

        handleRefundCredits();

      }

    } catch (err) {
      error("Scrambling failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, algorithm, seed, rows, cols, scramblingPercentage, maxHueShift, maxIntensityShift, error, userData]);


  const loadScrambledVideo = async () => {
    try {
      const response = await fetch(`${Flask_API_URL}/download/${scrambledFilename}`);
      if (!response.ok) throw new Error('Failed to load scrambled video');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (scrambledVideoRef.current) {
        scrambledVideoRef.current.src = url;
        console.log("SCRAMBLED VIDEO URL SET: " + url)
      }
      // let url = `${Flask_API_URL}/download/${scrambledFilename}`;
      // if (url.includes("mp4")) {
      //   // if  "mp4" is the extenstion in the URL, change it to webm
      //   if (url.endsWith("mp4")) {
      //     url = url.replace("mp4", "webm");
      //   }
      // }
      // scrambledVideoRef.current.src = url;
      // console.log("SCRAMBLED VIDEO URL SET: " + url)

    } catch (err) {
      error("Failed to load scrambled video: " + err.message);
    }
  };

  const downloadScrambledVideo = async () => {
    if (!scrambledFilename) {
      error("Please scramble an video first");
      return;
    }

    try {
      const response = await fetch(`${Flask_API_URL}/download/${scrambledFilename}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "scrambled_" + scrambledFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      success("Scrambled video downloaded!");
    } catch (err) {
      error("Download failed: " + err.message);
    }
  };

  const handleCreditConfirm = useCallback((actualCostSpent) => {
    setShowCreditModal(false);

    setAllowScrambling(true);

    // Now you have access to the actual cost that was calculated and spent
    console.log('Credits spent:', actualCostSpent);

    // You can use this value for logging, analytics, or displaying to user
    // For example, update a state variable:
    // setLastCreditCost(actualCostSpent);
    setActionCost(actualCostSpent);

    // Call scrambleVideo directly (it will use current state values)
    scrambleVideo();

  }, [scrambleVideo]);

  const handleRefundCredits = async () => {
    const result = await refundCredits({
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      credits: actionCost,
      currentCredits: userCredits,
      password: localStorage.getItem('passwordtxt'),
      action: 'scramble_video_pro',
      params: {

        scrambleLevel: scrambleLevel,
        grid: { rows, cols },
        seed: seed,
        algorithm: algorithm,
        percentage: scramblingPercentage
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
          <AutoAwesome />
          🚀 Pro Video Scrambler
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Advanced server-side scrambling with multiple algorithms
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Server Based" size="small" color="success" />
          <Chip label="Format: MP4/WEBM" size="small" />
          <Chip label="HD/FHD" size="small" color="primary" />
        </Box>
      </Box>

      {/* Main Scramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Shuffle />
            Scramble Video (Server-Side)
          </Typography>

          {/* File Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Select Video File
            </Typography>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="video-upload-pro"
              ref={fileInputRef}
            />
            <label htmlFor="video-upload-pro">
              <Button
                variant="contained"
                component="span"
                startIcon={<PhotoCamera />}
                sx={{ backgroundColor: '#2196f3', color: 'white', mb: 1 }}
              >
                Choose Video File
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


              {/* Position, Rotation, Mirror - need rows/cols */}
              {(algorithm === 'position' || algorithm === 'rotation' || algorithm === 'mirror') && (
                <>
                  <Grid item xs={6} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Rows"
                      value={rows}
                      // TODO:
                      // this value is not updating properly
                      // when passed to the backend its always 6
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
                      // TODO:
                      // this value is not updating properly
                      // when passed to the backend its always 6
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

            {/* <Grid item xs={12} md={6}>
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
              </Grid> */}

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
              disabled={!videoLoaded || isProcessing}
              sx={{
                backgroundColor: (!videoLoaded || isProcessing) ? '#666' : '#22d3ee',
                color: (!videoLoaded || isProcessing) ? '#999' : '#001018',
                fontWeight: 'bold'
              }}
            >
              {isProcessing ? 'Processing...' : 'Scramble on Server'}
            </Button>

            <Button
              variant="contained"
              onClick={downloadScrambledVideo}
              startIcon={<Download />}
              disabled={!scrambledFilename}
              sx={{ backgroundColor: '#9c27b0', color: 'white' }}
            >
              Download Scrambled Video
            </Button>
          </Box>

          {/* Video Comparison */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
            <Grid container spacing={3}>
              {/* Original Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Original Video
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
                  {selectedFile ? (
                    <>
                      <video
                        ref={displayVideoRef}
                        controls
                        src={previewUrl}
                        style={{
                          width: '100%',
                          maxHeight: '400px',
                          backgroundColor: '#0b1020',
                          borderRadius: '8px'
                        }}
                      />

                      <video

                        // ref={previewImg}
                        ref={videoRef}
                        // ref={displayVideoRef}
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
                      Select a video to preview
                    </Typography>
                  )}
                </Box>
                {videoLoaded && (
                  <Typography variant="caption" sx={{ color: '#4caf50', mt: 1, display: 'block' }}>
                    Video loaded: {displayVideoRef.current?.videoWidth}×{displayVideoRef.current?.videoHeight}px
                  </Typography>
                )}
              </Grid>

              {/* Scrambled Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  Scrambled Video Preview
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
                    <>
                      <video
                        ref={scrambledVideoRef}
                        src={scrambledFilename ? `${Flask_API_URL}/download/${scrambledFilename}` : ''}
                        alt="Scrambled"
                        style={{
                          width: '100%',
                          maxHeight: '400px',
                          backgroundColor: '#0b1020',
                          borderRadius: '8px'
                        }}
                        controls
                      />
                    </>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Scrambled video will appear here
                    </Typography>
                  )}
                </Box>
                {scrambledFilename && (
                  <Typography>
                    {scrambledFilename + ' loaded. Size: ' + (scrambledVideoRef.current?.videoWidth || 0) + '×' + (scrambledVideoRef.current?.videoHeight || 0) + 'px'}
                  </Typography>
                )}

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

      {/* Processing Modal */}
      <ProcessingModal open={isProcessing} mediaType="video" />

      {/* Credit Confirmation Modal */}

      {showCreditModal && <CreditConfirmationModal
        open={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onConfirm={handleCreditConfirm}
        mediaType="video"

        scrambleLevel={scrambleLevel}
        currentCredits={userCredits}
        fileName={selectedFile?.name || ''}
        file={selectedFile}
        fileDetails={{
          type: 'video',
          size: selectedFile?.size || 0,
          name: selectedFile?.name || '',
          horizontal: displayVideoRef.current?.videoWidth || 0,
          vertical: displayVideoRef.current?.videoHeight || 0,
          duration: displayVideoRef.current?.duration || 0
        }}
        user={userData}
        isProcessing={false}
        actionType="scramble-video-pro"
        actionDescription="pro level video scrambling"
      />}

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
