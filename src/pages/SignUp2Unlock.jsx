// import React from 'react';
import React, { useEffect, useState } from 'react';
import { Container, Typography, Stack, Skeleton, Grid2 as Grid, Box, Alert, Paper } from '@mui/material';
import api from '../api/client';
import KeyCard from '../components/KeyCard';
import KeyRevealDialog from '../components/KeyRevealDialog';
import { useToast } from '../contexts/ToastContext';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

export default function Unlock() {

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keyValue, setKeyValue] = useState('');
  const [open, setOpen] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { error, info, success } = useToast();
  const params = useParams();


  const userData = JSON.parse(localStorage.getItem("userdata") || '{"username":"user_123","email":"user_123@example.com"}');



  // Mock data for different key types
  const mockKeys = {
    1: [
      'ABCD-EFGH-IJKL-MNOP-QRST',
      'WXYZ-1234-5678-9ABC-DEFG',
      'HIJK-LMNO-PQRS-TUVW-XYZA',
      'BCDE-FGHI-JKLM-NOPQ-RSTU'
    ],
    2: [
      'steam-key-ABCD123456789',
      'steam-key-EFGH987654321',
      'steam-key-IJKL456789123'
    ],
    3: [
      'netflix-premium-2024-ABCD',
      'netflix-premium-2024-EFGH',
      'netflix-premium-2024-IJKL'
    ],
    4: [
      'office365-ABCD-EFGH-IJKL-MNOP',
      'office365-WXYZ-1234-5678-9ABC'
    ]
  };

  // Mock items data
  const mockItems = {
    1: { id: 1, title: 'Windows 11 Pro Keys', description: 'Genuine Windows 11 Professional activation keys', price_credits: 250, quantity: 50, sold: 12, available: 38 },
    2: { id: 2, title: 'Steam Game Keys', description: 'Premium PC game keys for Steam platform', price_credits: 150, quantity: 25, sold: 8, available: 17 },
    3: { id: 3, title: 'Netflix Premium Accounts', description: '30-day Netflix Premium subscription codes', price_credits: 100, quantity: 30, sold: 15, available: 15 },
    4: { id: 4, title: 'Office 365 License Keys', description: 'Microsoft Office 365 Business licenses', price_credits: 300, quantity: 20, sold: 5, available: 15 }
  };

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

  useEffect(() => {
    (async () => {
      try {
        // Simulate API delay
        // await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Use the actual JSON Server endpoint: /createdKeys/:id
        const { data } = await api.get(`/api/createdKey/${params.id}`);
        // console.log('Fetched item:', data);
        if (data) {
          setItem(data.key);
          
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (e) {
        console.error('Error fetching key listing:', e);
        // Use mock data as fallback
        const mockItem = mockItems[params.id] || mockItems[1];
        setItem(mockItem);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const navigate = useNavigate();

  const handleUnlock = async (item) => {
    if (isUnlocking) return;

    setIsUnlocking(true);

    navigate('/login');

    // try {
    //   info('Unlocking key...');

    //   // Simulate API delay
    //   // await new Promise(resolve => setTimeout(resolve, 1500));

    //   const { data } = await api.post(`/api/unlock/${item.id}`,
    //     {
    //       // You can include any necessary payload here
    //       username: userData.username,
    //       email: userData.email,
    //     }
    //   );

    //   if (data?.key) {
    //     setKeyValue(data.key);
    //     setOpen(true);
    //     success('Key unlocked successfully!');
    //   } else {
    //     error('Unlock failed - no key returned');
    //   }
    // } catch (e) {
    //   console.error('Unlock error:', e);

    //   // Mock unlock logic for demo
    //   if (Math.random() > 0.3) { // 70% success rate
    //     const keys = mockKeys[item.id] || mockKeys[1];
    //     const randomKey = keys[Math.floor(Math.random() * keys.length)];
    //     setKeyValue(randomKey);
    //     setOpen(true);
    //     success('Key unlocked successfully!');

    //     // Update item availability
    //     if (item.available > 0) {
    //       setItem(prev => ({
    //         ...prev,
    //         available: prev.available - 1,
    //         sold: prev.sold + 1
    //       }));
    //     }
    //   } else if (Math.random() > 0.5) {
    //     error('Insufficient credits to unlock this key');
    //   } else {
    //     error('Server error - please try again later');
    //   }
    // } finally {
    //   setIsUnlocking(false);
    // }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Skeleton variant="text" width={300} height={40} />
            <Skeleton variant="text" width={500} height={24} />
          </Box>
          <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 2 }} />
        </Stack>
      </Container>
    );
  }

  if (!item) {
    return (
      <Container sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h4" color="error">Key Not Found</Typography>
          <Alert severity="error">
            The requested key listing could not be found. It may have been removed or sold out.
          </Alert>
        </Stack>
      </Container>
    );
  } return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h3" color="primary.main" gutterBottom sx={{ fontWeight: 700 }}>
            Login/Sign Up to Unlock Key
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.8, mb: 2 }}>
            Review the key details and click login/unlock to reveal your purchased key.
          </Typography>
        </Box>

        {/* Key Information */}
        <Paper sx={{ p: 3, bgcolor: 'grey.900', borderRadius: 6, border: '5px solid rgba(248, 217, 15, 0.68)' }}>
          <Stack spacing={2}>
            <Typography variant="h5" gutterBottom>
              Key Details
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Title
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {item.keyTitle}
                </Typography>
              </Grid>
              <Grid xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Price
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {item.price} credits
                </Typography>
              </Grid>
              <Grid xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {item.description}
                </Typography>
              </Grid>
              <Grid xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Quantity
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {item.quantity}
                </Typography>
              </Grid>
              <Grid xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Sold
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {item.sold}
                </Typography>
              </Grid>
              <Grid xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Available
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {item.available}
                </Typography>
              </Grid>
            </Grid>
          </Stack>
        </Paper>

        {/* Key Card */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ maxWidth: 400, width: '100%' }}>
            <KeyCard

              item={{
                ...item,
                dark: false // Ensure it uses elevated variant for better visibility
              }}
              onUnlock={() => handleUnlock(item)}
            />
            {isUnlocking && (
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  mt: 2,
                  color: 'primary.main',
                  fontStyle: 'italic'
                }}
              >
                Unlocking key, please wait...
              </Typography>
            )}
          </Box>
        </Box>

        {/* Instructions */}
        <Alert severity="info" sx={{ mt: 3 }}>
          {/* <Typography variant="body2">
            <strong>Important:</strong> Once unlocked, make sure to copy and save your key immediately.
            Keys are ephemeral and subject to deletion by the key creator.
          </Typography> */}

          <Typography variant="body2">
            <strong>Important:</strong> Once unlocked, make sure to copy and save your key immediately.
            Keys are only shown one time.
          </Typography>
        </Alert>

        {/* Key Reveal Dialog */}
        <KeyRevealDialog
          open={open}
          onClose={() => setOpen(false)}
          title={`Your Key: ${item.keyTitle}`}
          value={keyValue}
        />
      </Stack>
    </Container>
  );
}