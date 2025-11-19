// CreditConfirmationModal.jsx - Confirm credit spending before scrambling
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Alert,
  Chip
} from '@mui/material';
import {
  MonetizationOn,
  Info,
  Warning,
  Description
} from '@mui/icons-material';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';

// {/* Credit Confirmation Modal */ }
// <CreditConfirmationModal
//   open={showCreditModal}
//   onClose={() => setShowCreditModal(false)}
//   onConfirm={handleCreditConfirm}
//   mediaType="photo"
//   creditCost={SCRAMBLE_COST}
//   currentCredits={userCredits}
//   fileName={imageFile?.name || ''}
//   isProcessing={isProcessing}
//   selectedFile={imageFile}
//   fileDetails={{
//     type: 'image',
//     size: imageFile?.size || 0,
//     name: imageFile?.name || '',
//     horizontal: imageRef.current?.naturalWidth || 0,
//     vertical: imageRef.current?.naturalHeight || 0
//   }}
//   user={userData}
// />

export default function CreditConfirmationModal({
  open,
  onClose,
  onConfirm,
  mediaType = 'video', // 'video' or 'photo'
  description = '',
  creditCost = 10,
  currentCredits = 0,
  fileName = '',
  isProcessing = false,
  fileDetails = {
    type: 'image',
    size: 0,
    name: '',
    horizontal: 0,
    vertical: 0,
    duration: 0
  },
  selectedFile,
  user
}) {
  const { success, error } = useToast();

  const [totalCost, setTotalCost] = useState(creditCost);
  const [userCredits, setUserCredits] = useState(currentCredits);
  const [hasEnoughCredits, setHasEnoughCredits] = useState(false);
  const [remainingCredits, setRemainingCredits] = useState(0);

  // =============================
  // API CALLS
  // =============================


  useEffect(async () => {
    console.log('Fetching user credits for', user.username);
    const response = await api.post(`api/wallet/balance/${user.username}`, {
      username: user.username,
      email: user.email,
      password: localStorage.getItem('passwordtxt')
    });

    if (response.status === 200 && response.data) {
      setUserCredits(response.data.credits);
    }
  }, []);


  const spendCredits = async () => {

    if (!selectedFile) {
      error("Please select a file first");
      return null;
    }

    alert('Spending ' + totalCost + ' credits to scramble ' + (selectedFile?.name || 'untitled'));

    try {
      
      console.log('Attempting to spend credits:', {
        username: user.username,
        cost: totalCost,
        mediaType
      });

      const response = await api.post(`api/spend-credits/${user.username}`, {
        username: user.username,
        cost: totalCost,
        mediaType,
        action: {
          type: 'scramble',
          cost: totalCost,
          description: `Scrambling ${mediaType}: ${selectedFile?.name || 'untitled'}`
        }
      });

    

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Credit spending failed:', errorData);
      throw new Error(errorData.message || 'Credit spending failed');
    }

    const data = await response.json();
    console.log('Credits spent successfully:', data);

    success(`Successfully spent ${totalCost} credits!`);

    // Update local credits state
    setUserCredits(data.credits);

    return data;
  } catch (err) {
    console.error('SpendCredits error:', err);
    error("Failed to process credits: " + err.message);
    return null;
  }
};

useEffect(() => {
  // Calculate cost based on fileDetails
  let calculatedCost = creditCost;

  if (!fileDetails || (!fileDetails.horizontal && !fileDetails.vertical)) {
    // No file details available, use base cost
    setTotalCost(creditCost);
    setHasEnoughCredits(userCredits >= creditCost);
    setRemainingCredits(userCredits - creditCost);
    return () => {console.log('No file details available for cost calculation');};
  } else {
    // Handle the case where fileDetails is available but lacks horizontal and vertical properties
  }

  const LQ = 2;
  const SDcharge = 3;
  const HDcharge = 5;
  const FHDCharge = 10;

  if (mediaType === 'photo') {
    // Calculate cost based on photo resolution from fileDetails
    const width = fileDetails.horizontal;
    const height = fileDetails.vertical;

    console.log('Photo Dimensions:', width, 'x', height);
    console.log('Photo Size:', fileDetails.size, 'bytes');

    if (width >= 1920 && height >= 1080) {
      calculatedCost = creditCost + FHDCharge;
    } else if (width >= 1280 && height >= 720) {
      calculatedCost = creditCost + HDcharge;
    } else if (width >= 854 && height >= 480) {
      calculatedCost = creditCost + SDcharge;
    } else {
      calculatedCost = creditCost + LQ;
    }

    console.log('Calculated Photo Cost:', calculatedCost);

  } else if (mediaType === 'video') {
    // Calculate cost based on video resolution and duration from fileDetails
    const width = fileDetails.horizontal;
    const height = fileDetails.vertical;
    const duration = Math.ceil((fileDetails.duration || 0) / 60); // duration in minutes

    console.log('Video Duration:', fileDetails.duration, 'seconds (', duration, 'minutes)');
    console.log('Video Resolution:', width, 'x', height);
    console.log('Video Size:', fileDetails.size, 'bytes');

    let resolutionCost = LQ;
    if (width >= 1920 && height >= 1080) {
      resolutionCost = FHDCharge;
    } else if (width >= 1280 && height >= 720) {
      resolutionCost = HDcharge;
    } else if (width >= 854 && height >= 480) {
      resolutionCost = SDcharge;
    }

    calculatedCost = creditCost + (duration * resolutionCost);

    console.log('Calculated Video Cost:', calculatedCost);
  }

  setTotalCost(calculatedCost);
  setHasEnoughCredits(userCredits >= calculatedCost);
  setRemainingCredits(userCredits - calculatedCost);

}, [fileDetails, mediaType, creditCost, userCredits]);



return (
  <Dialog
    open={open}
    onClose={isProcessing ? null : onClose}
    maxWidth="sm"
    fullWidth
  >
    <DialogTitle sx={{
      backgroundColor: '#424242',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      // color: '#e8dd12ff'
    }}>
      <MonetizationOn />
      Confirm Credit Usage
    </DialogTitle>

    <DialogContent sx={{ backgroundColor: '#171717ff', pt: 3 }}>
      {/* File Info */}
      <Box sx={{ mb: 2, py: 1 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          You are about to scramble:
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#424242' }}>
          {fileName || `Untitled ${mediaType}`}
          {/* list attributes of video or photo */}
          <Typography variant="body2" color="text.secondary">
            {mediaType === 'video'
              ? `Duration: ${fileDetails.duration ?? 'Unknown'} | Resolution: ${fileDetails.horizontal}x${fileDetails.vertical} | Size: ${fileDetails.size ?? 'Unknown'}`
              : `Dimensions: ${fileDetails.horizontal}x${fileDetails.vertical} | Size: ${Math.floor(fileDetails.size / 1000) ?? 'Unknown'} KB`}
          </Typography>
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Credit Breakdown */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body1">Current Credits:</Typography>
          <Chip
            label={`${userCredits} credits`}
            color="primary"
            size="small"
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body1">Scrambling Cost:</Typography>
          <Chip
            label={`-${totalCost} credits`}
            color="warning"
            size="small"
          />
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            Remaining Credits:
          </Typography>
          <Chip
            label={`${remainingCredits} credits`}
            color={hasEnoughCredits ? 'success' : 'error'}
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </Box>

      {/* Warnings */}
      {!hasEnoughCredits ? (
        <Alert severity="error" icon={<Warning />} sx={{ mb: 2 }}>
          <strong>Insufficient Credits!</strong> You need {totalCost - userCredits} more credits to scramble this {mediaType}.
        </Alert>
      ) : remainingCredits < 10 && (
        <Alert severity="warning" icon={<Info />} sx={{ mb: 2 }}>
          <strong>Low Credits Warning:</strong> You'll have only {remainingCredits} credits remaining. Consider purchasing more credits soon.
        </Alert>
      )}

      {/* Info Box */}
      <Box sx={{
        backgroundColor: '#e3f2fd',
        p: 2,
        borderRadius: 1,
        border: '1px solid #2196f3'
      }}>
        <Typography variant="body2" color="black">
          💡 <strong>What happens next:</strong> Your {mediaType} will be scrambled using our secure algorithm.
          Credits will be deducted only after successful processing.
        </Typography>
      </Box>
    </DialogContent>

    <DialogActions sx={{ backgroundColor: '#f5f5f5', p: 2 }}>
      <Button
        onClick={onClose}
        disabled={isProcessing}
        sx={{ color: '#666' }}
      >
        Cancel
      </Button>
      <Button
        onClick={async () => { await spendCredits(); onConfirm(); alert('Credits spent and scrambling started!'); }}
        variant="contained"
        disabled={!hasEnoughCredits || isProcessing}
        sx={{
          backgroundColor: hasEnoughCredits ? '#22d3ee' : '#666',
          color: hasEnoughCredits ? '#001018' : '#999',
          fontWeight: 'bold',
          '&:hover': {
            backgroundColor: hasEnoughCredits ? '#1cb5d0' : '#666'
          }
        }}
      >
        {isProcessing ? 'Processing...' : `Spend ${totalCost} Credits & Scramble`}
      </Button>
    </DialogActions>
  </Dialog>
);
}
