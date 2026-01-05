// VideoUnscramblerPro.jsx — Video Unscrambler React Component (Pro Version)
// Unscrambles videos that were scrambled with the video scrambler pro
// Uses server-side processing for advanced unscrambling algorithms

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
  Alert,
  IconButton,
  Chip,
  Modal,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import {
  VideoFile,
  Key,
  Upload,
  LockOpen,
  Download,
  Movie,
  VpnKey,
  CloudDownload,
  CloudUpload,
  AutoAwesome,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import CreditConfirmationModal from '../components/CreditConfirmationModal';
import ProcessingModal from '../components/ProcessingModal';
import { refundCredits } from '../utils/creditUtils';
import api from '../api/client';

export default function VideoUnscramblerPro() {
  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';
  const Flask_API_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000';

  const { success, error } = useToast();

  // Refs for video elements
  const displayVideoRef = useRef(null);
  const videoRef = useRef(null);
  const scrambledVideoRef = useRef(null);
  const unscrambledVideoRef = useRef(null);
  const keyFileInputRef = useRef(null);
  const videoUrlRef = useRef(null); // Store URL for cleanup

  // State variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [keyCode, setKeyCode] = useState('');
  const [decodedParams, setDecodedParams] = useState(null);
  // const [unscrambledFilename, setScrambledFilename] = useState('');
  const [unscrambledFilename, setUnscrambledFilename] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [unscrambledReady, setUnscrambledReady] = useState(false);
  const [scrambleLevel, setScrambleLevel] = useState(1); // Level of scrambling (for credit calculation)

  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userdata")));
  const [allowUnscrambling, setAllowUnscrambling] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  // const actionCost = 15; // Cost to unscramble a video (pro version)
  const [actionCost, setActionCost] = useState(15); // Cost to unscramble a video (pro version)
  const [previewUrl, setPreviewUrl] = useState('');


  // ========== UTILITY FUNCTIONS ==========

  // Base64 encoding/decoding utilities
  const fromBase64 = (b64) => decodeURIComponent(escape(atob(b64.trim())));

  // XOR decryption function
  const xorEncrypt = (text, key) => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  };


  const decryptKeyData = () => {
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


  const handleKeyFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Try to decrypt the key file (if it's encrypted)
      try {
        const keyData = decryptKeyData(text);
        // Set the decoded parameters directly
        setDecodedParams(keyData);
        setKeyCode(text); // Store the encrypted key in the text box
        success('🔑 Key file loaded and decoded successfully!');
      } catch (decryptErr) {
        // If decryption fails, try to parse as plain JSON or base64
        try {
          // Check if it's base64 encoded
          const decoded = fromBase64(text.trim());
          const keyData = JSON.parse(decoded);
          setDecodedParams(keyData);
          setKeyCode(text.trim());
          console.log("Decoded key data from base64:", keyData);
          success('🔑 Key file loaded and decoded successfully!');
        } catch (base64Err) {
          // Try direct JSON parse
          const keyData = JSON.parse(text);
          setDecodedParams(keyData);
          setKeyCode(btoa(text)); // Convert to base64 for consistency
          success('🔑 Key file loaded and decoded successfully!');
        }

        if (decodedParams.type !== "video") {
          error('The loaded key file is not a valid video scramble key.');
        } else if (decodedParams.version !== "premium" || decodedParams.version !== "standard") {
          error('Use the ' + decodedParams.version + ' ' + decodedParams.type + ' scrambler to unscramble this file.');
          alert('The loaded key file will not work with this scrambler version, you must use the ' + decodedParams.version + ' ' + decodedParams.type + ' scrambler to unscramble this file.');
        }
      }
    } catch (err) {
      console.error("Error loading key:", err);
      error('Invalid or corrupted key file. Please check the file format.');
    }
  };

  // ========== EVENT HANDLERS ==========

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      error("Please select a valid video file");
      return;
    }

    // Clean up previous URL if it exists
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }

    setSelectedFile(file);
    setVideoLoaded(false);
    setUnscrambledReady(false);
    // setScrambledFilename('');
    setUnscrambledFilename('');

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


    // const video = scrambledVideoRef.current;

    // if (video) {
    //   video.onloadedmetadata = () => {
    //     console.log("Video loaded successfully");
    //     console.log("Video dimensions:", video.videoWidth, "x", video.videoHeight);
    //     console.log("Video duration:", video.duration);
    //     setVideoLoaded(true);
    //     // Don't revoke URL here - the video element still needs it
    //   };

    //   video.onerror = (e) => {
    //     console.error("Video load error:", e);
    //     error("Failed to load the selected video");
    //     setVideoLoaded(false);
    //     // Clean up on error
    //     if (videoUrlRef.current) {
    //       URL.revokeObjectURL(videoUrlRef.current);
    //       videoUrlRef.current = null;
    //     }
    //   };

    //   video.src = url;

    console.log("Video source set to selected file");
    console.log("Video Source URL:", url);
    // }
  };

  const decodeKeyCode = () => {
    try {
      const json = fromBase64(keyCode);
      const params = JSON.parse(json);
      setDecodedParams(params);
      success('Key code decoded successfully!');
      console.log("Decoded key parameters:", params);
    } catch (e) {
      error('Invalid key code: ' + e.message);
    }
  };

  const unscrambleVideo = useCallback(async () => {
    if (!selectedFile) {
      error("Please select a video first");
      return;
    }

    if (!decodedParams) {
      error("Please decode the key code first");
      return;
    }

    setIsProcessing(true);

    try {
      // Create FormData with file and parameters
      const formData = new FormData();
      formData.append('file', selectedFile);

      formData.append('params', JSON.stringify({
        ...decodedParams,
        mode: 'unscramble',
        input: selectedFile.name,
        output: `unscrambled_${selectedFile.name}`
      }));

      const params = {
        ...decodedParams,
        mode: 'unscramble',
        input: selectedFile.name,
        output: `unscrambled_${selectedFile.name}`
      };

      console.log("Unscramble parameters:", params);

      setScrambleLevel(params.cols >= params.rows ? params.cols : params.rows);

      try {

        // Call unscramble endpoint
        const response = await fetch(`${API_URL}/api/unscramble-video`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        console.log("Video Unscramble response:", response);

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

        setUnscrambledFilename(tempFileName);
        console.log("Unscrambled video filename:", tempFileName);
        // setUnscrambledReady(true);

        // Load unscrambled video preview
        // await 
        loadUnscrambledVideo();

        success("Video unscrambled successfully!");

      } catch (e) {
        error("Unscrambling failed: " + e.message);
        setIsProcessing(false);
        // try {
        // TODO: Refund credits if applicable
        handleRefundCredits();

      }

    } catch (err) {
      error("Unscrambling failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, decodedParams, allowUnscrambling]);

  const loadUnscrambledVideo = async () => {
    try {
      const response = await fetch(`${Flask_API_URL}/download/${unscrambledFilename}`);
      if (!response.ok) throw new Error('Failed to load unscrambled video');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (unscrambledVideoRef.current) {
        unscrambledVideoRef.current.src = url;
        console.log("UNSCRAMBLED VIDEO URL SET: " + url);
        setVideoUrl(url);
      }

      // let url = `${Flask_API_URL}/download/${unscrambledFilename}`;
      // if (url.includes("mp4")) {
      //   // if  "mp4" is the extenstion in the URL, change it to webm
      //   if (url.endsWith("mp4")) {
      //     url = url.replace("mp4", "webm");
      //   }
      // }
      // unscrambledVideoRef.current.src = url;
      // console.log("UNSCRAMBLED VIDEO URL SET: " + url)

      // if (scrambledDisplayRef.current) {
      //   scrambledDisplayRef.current.src = url;
      // }
    } catch (err) {
      error("Failed to load unscrambled video: " + err.message);
    }
  };

  const downloadUnscrambledVideo = async () => {
    if (!unscrambledFilename) {
      error("Please unscramble a video first");
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

      success("Unscrambled video downloaded!");
    } catch (err) {
      error("Download failed: " + err.message);
    }
  };

  const handleCreditConfirm = useCallback((actualCostSpent) => {
    setShowCreditModal(false);

    setAllowUnscrambling(true);

    // Now you have access to the actual cost that was calculated and spent
    console.log('Credits spent:', actualCostSpent);

    // You can use this value for logging, analytics, or displaying to user
    // For example, update a state variable:
    // setLastCreditCost(actualCostSpent);
    setActionCost(actualCostSpent);

    // Use setTimeout to ensure state update completes before scrambling
    setTimeout(() => {
      unscrambleVideo();
    }, 0);

  }, [selectedFile, decodedParams, allowUnscrambling]);

  const handleRefundCredits = async () => {
    const result = await refundCredits({
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      credits: actionCost,
      currentCredits: userCredits,
      password: localStorage.getItem('passwordtxt'),
      params: decodedParams,
      action: 'unscramble-video-pro'
    });

    if (result.success) {
      error(`An error occurred during scrambling. ${result.message}`);
    } else {
      error(`Scrambling failed. ${result.message}`);
    }
  };



  useEffect(() => {
    const fetchUserData = async () => {
      const userData = JSON.parse(localStorage.getItem("userdata"));
      setUserData(userData);

      if (userData) {
        try {
          const response = await api.post(`api/wallet/balance/${userData.username}`, {
            username: userData.username,
            email: userData.email,
            password: localStorage.getItem('passwordtxt')
          });

          if (response.status === 200 && response.data) {
            setUserCredits(response.data.credits);
          }
        } catch (err) {
          console.error("Failed to fetch user credits:", err);
        }
      }
    };

    fetchUserData();

    // Cleanup function - revoke object URL when component unmounts
    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, []);

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="primary.main" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Movie />
          🎬 Video Unscrambler Pro
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload a scrambled video, enter the key code, and restore the original using server-side processing.
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip label="Format: MP4, AVI, MOV" size="small" />
          <Chip label="Server Processing" size="small" />
          <Chip label="Advanced Algorithms" size="small" />
          <Chip icon={<AutoAwesome />} label="Pro Version" color="secondary" size="small" />
        </Box>
      </Box>

      {/* Main Unscramble Section */}
      <Card elevation={3} sx={{ backgroundColor: '#424242', color: 'white', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockOpen />
            Unscramble a Video (Server-Side Processing)
          </Typography>

          {/* File Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Upload Scrambled Video
            </Typography>
            <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
              Scramble Key File
            </Typography>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="video-upload"
            />
            <label htmlFor="video-upload">
              <Button
                variant="contained"
                component="span"
                startIcon={<VideoFile />}
                sx={{ backgroundColor: '#2196f3', color: 'white' }}
              >
                Choose Video File
              </Button>
            </label>
            {selectedFile && (
              <Typography variant="body2" sx={{ mt: 1, color: '#4caf50' }}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            )}
            {videoLoaded && scrambledVideoRef.current && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#4caf50' }}>
                Video loaded: {scrambledVideoRef.current.videoWidth}×{scrambledVideoRef.current.videoHeight}px, {scrambledVideoRef.current.duration.toFixed(2)}s
              </Typography>
            )}
          </Box>

          {/* Key Code Input */}
          <Box sx={{ mb: 3 }}>

            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ color: '#bdbdbd', mb: 1 }}>
                Scramble Key File
              </Typography>
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
            <strong style={{ fontSize: 24, margin: '0 16px' }}> OR </strong>
            <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
              Enter Key Code
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={keyCode}
              onChange={(e) => setKeyCode(e.target.value)}
              placeholder="eyJzZWVkIjoxMjM0NSwibiI6MywibSI6MywicGVybTFiYXNlZCI6WzMsMiw1LDEsNyw2LDksNCw4XX0="
              sx={{
                mb: 2,
                '& .MuiInputBase-root': {
                  backgroundColor: '#353535',
                  color: 'white',
                  fontFamily: 'monospace'
                }
              }}
            />


            {/* Step buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={decodeKeyCode}
                startIcon={<Key />}
                sx={{ backgroundColor: '#9c27b0', color: 'white' }}
                disabled={!keyCode.trim()}
              >
                Step 1: Decode Key
              </Button>

              <Button
                variant="contained"
                onClick={() => setShowCreditModal(true)}
                startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudUpload />}
                disabled={!videoLoaded || !decodedParams || isProcessing}
                sx={{
                  backgroundColor: (!videoLoaded || !decodedParams || isProcessing) ? '#666' : '#4caf50',
                  color: (!videoLoaded || !decodedParams || isProcessing) ? '#999' : 'white',
                  fontWeight: 'bold'
                }}
              >
                {isProcessing ? 'Processing...' : 'Step 2: Unscramble Video'}
              </Button>

              <Button
                variant="outlined"
                onClick={downloadUnscrambledVideo}
                startIcon={<Download />}
                sx={{ borderColor: '#22d3ee', color: '#22d3ee' }}
                disabled={!unscrambledFilename}
              >
                Download Unscrambled Video
              </Button>
            </Box>
          </Box>

          {/* Video Comparison */}
          <Box sx={{ borderTop: '1px solid #666', pt: 3 }}>
            <Grid container spacing={3}>
              {/* Scrambled Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  <strong> Input: </strong>Scrambled Video
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
                  {videoLoaded ? (
                    // <video
                    //   ref={scrambledVideoRef}
                    //   // src={scrambledVideoRef.current?.src || ''}
                    //   controls
                    //   style={{
                    //     maxWidth: '100%',
                    //     maxHeight: '400px',
                    //     borderRadius: '8px'
                    //   }}
                    // />
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
                  ) : selectedFile ? (
                    <Typography variant="body2" sx={{ color: '#ff9800' }}>
                      Loading video...
                    </Typography>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        Select a scrambled video to preview
                      </Typography>
                    </>

                  )}
                </Box>
                {videoLoaded && (
                  <Typography variant="caption" sx={{ color: '#4caf50', mt: 1, display: 'block' }}>
                    Video loaded: {displayVideoRef.current?.videoWidth}×{displayVideoRef.current?.videoHeight}px
                  </Typography>
                )}
              </Grid>

              {/* Unscrambled Video */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 1, color: '#e0e0e0' }}>
                  <strong> Output: </strong> Unscrambled Video Preview
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
                    <video
                      ref={unscrambledVideoRef}
                      src={unscrambledFilename ? `${Flask_API_URL}/download/${unscrambledFilename}` : ''}
                      alt="Scrambled"
                      controls
                      style={{
                        width: '100%',
                        maxHeight: '400px',
                        backgroundColor: '#0b1020',
                        borderRadius: '8px'
                      }}
                    />
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        Unscrambled video will appear here
                      </Typography>
                    </>
                  )}

                </Box>
                {unscrambledFilename && (
                  <Typography>
                    {unscrambledFilename + ' loaded. Size: ' + (unscrambledVideoRef.current?.videoWidth || 0) + '×' + (unscrambledVideoRef.current?.videoHeight || 0) + 'px'}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Info section */}
      <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 4 }}>
        <Typography variant="body2" color="black">
          💡 <strong>Pro Version:</strong> Upload a scrambled video and your key code. The server processes your video using
          advanced algorithms (position, color, rotation, mirror, intensity) to restore the original content.
          This requires {actionCost} credits per video.
        </Typography>
      </Paper>

      {/* Credit Confirmation Modal */}
      <CreditConfirmationModal
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
        actionType="unscramble-video-pro"
        actionDescription="pro level video unscrambling"
      />

      {/* Processing Modal */}
      <ProcessingModal open={isProcessing} mediaType="video" />
    </Container>
  );
}