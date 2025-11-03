import React, { useEffect, useState } from 'react';
import { Container, Stack, Typography, Card, CardContent, Divider, Skeleton, Button } from '@mui/material';
import PaymentButton from '../components/PaymentButton';
import Notifications from '../components/Notifications.jsx';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { Password } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

export default function Wallet() {
    const [balance, setBalance] = useState(null);
    const { success, error } = useToast();
    const accountType = localStorage.getItem('accountType'); // 'buyer', 'seller', or null
    const userData = JSON.parse(localStorage.getItem("userdata") || '{"username":"user_123"}');

    const navigate = useNavigate();

    // const load = async () => {

    //     try {
    //         // Direct API call to JSON Server
    //         let response;

    //         // fetch data if no data fetched before or last fetch was over 1.5 minutes ago
    //         let lastDataFetchTooOld = !localStorage.getItem('lastDataFetch') ||
    //             (Date.now() - parseInt(localStorage.getItem('lastDataFetch') || "0", 10) > 1.5 * 60 * 1000);

    //         if (lastDataFetchTooOld) {
    //             response = await api.post(`${API_URL}/api/user`, {
    //                 username: userData.username,
    //                 email: userData.email,
    //                 password: localStorage.getItem('passwordtxt')
    //             });

    //             if (response.status === 200 && response.data) {
    //                 console.log("User profile response data:", response.data);
    //                 localStorage.setItem('Earnings', JSON.stringify(response.data.earnings || []));
    //                 localStorage.setItem('Unlocks', JSON.stringify(response.data.unlocks || []));
    //                 localStorage.setItem('userdata', JSON.stringify(response.data.user || {}));
    //                 localStorage.setItem('lastDataFetch', Date.now().toString()); // Set account type
    //                 setBalance(response.data.user?.credits || 0); // Use credits from userData or fallback
    //             } else {
    //                 throw new Error('Failed to fetch wallet data');
    //             }
    //         } else {
    //             // Use cached data if not fetching new data
    //             const cachedUser = JSON.parse(localStorage.getItem('userdata') || '{}');
    //             setBalance(cachedUser.credits || 0);
    //         }
    //     } catch (e) {
    //         console.error('Error loading wallet balance:', e);
    //         setBalance(750); // demo fallback with realistic amount
    //         // clear local storage
    //         localStorage.clear();
    //         navigate('/info');
    //         setTimeout(() => { navigate('/login'); }, 15000); // Redirect to login after 15 seconds
    //     }

    // };

    // useEffect(() => { load(); }, []);

    const onPaymentError = () => error('Payment could not be started');

    return (
        <Container sx={{ py: 4, backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
            <Stack spacing={2}>
                {/* <Typography variant="h4" sx={{ color: '#ffd700', fontWeight: 700 }}>Main</Typography> */}
                
                <Card variant="outlined" sx={{
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #ffd700',
                    borderRadius: 2
                }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ color: '#ffd700' }}> What do you want to do?</Typography>
                        {/* {balance === null ? (
                            <Skeleton variant="text" width={220} height={54} animation="wave" />
                        ) : (
                            <Typography variant="h3" sx={{ fontWeight: 800, color: '#2e7d32' }}>{balance} credits</Typography>
                        )} */}

                    </CardContent>

                    {/* purchase button : go to purchase page */}

                    <CardContent>
                        <Divider sx={{ my: 2, borderColor: '#444' }} />
                        
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                                <Button
                                    onClick={() => navigate("/scrambler")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#2e7d32',
                                        '&:hover': {
                                            backgroundColor: '#2e7d32',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                   Scramble Video
                                </Button>
                                <Button
                                    onClick={() => navigate("/studio-mode")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#2e7d32',
                                        '&:hover': {
                                            backgroundColor: '#2e7d32',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Studio Mode
                                </Button>
                                <Button
                                    onClick={() => navigate("/unscrambler")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#2e7d32',
                                        '&:hover': {
                                            backgroundColor: '#2e7d32',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Unscramble Video
                                </Button>
                            </div>

                            {/* <Divider sx={{ my: 2, borderColor: '#444' }} /> */}

                    </CardContent>
                </Card>
                <Card variant="outlined" sx={{
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #ffd700',
                    borderRadius: 2
                }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ color: '#ffd700' }}>Current Balance</Typography>
                        {balance === null ? (
                            <Skeleton variant="text" width={220} height={54} animation="wave" />
                        ) : (
                            <Typography variant="h3" sx={{ fontWeight: 800, color: '#2e7d32' }}>{balance} credits</Typography>
                        )}

                    </CardContent>

                    {/* purchase button : go to purchase page */}

                    <CardContent>
                        <Divider sx={{ my: 2, borderColor: '#444' }} />
                        {/* {accountType === 'buyer' && ( */}
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                                <Button
                                    onClick={() => navigate("/wallet")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#2e7d32',
                                        '&:hover': {
                                            backgroundColor: '#2e7d32',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Get More Credits
                                </Button>
                                <Button
                                    onClick={() => navigate("/plans")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#2e7d32',
                                        '&:hover': {
                                            backgroundColor: '#2e7d32',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Your Plan
                                </Button>
                                <Button
                                    onClick={() => navigate("/purchase-history")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#2e7d32',
                                        '&:hover': {
                                            backgroundColor: '#2e7d32',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Purchase History
                                </Button>
                            </div>
                        {/* )} */}
                        {/* {accountType === 'seller' && (
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                                <Button
                                    onClick={() => navigate("/create-key")}
                                    variant="contained"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#0e0e06ff',
                                        '&:hover': {
                                            backgroundColor: '#7d752eff',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Create Keys
                                </Button>
                                <Button
                                    onClick={() => navigate("/earnings")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#7d7d2eff',
                                        color: '#7d7d2eff',
                                        '&:hover': {
                                            backgroundColor: '#7d752eff',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Earnings
                                </Button>
                                 <Button
                                    onClick={() => navigate("/listings")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#7d7d2eff',
                                        color: '#7d7d2eff',
                                        '&:hover': {
                                            backgroundColor: '#7d752eff',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Key Listings
                                </Button>
                                <Button
                                    onClick={() => navigate("/redeem")}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#2e7d32',
                                        color: '#2e7d32',
                                        '&:hover': {
                                            backgroundColor: '#2e7d32',
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    Redeem Credits
                                </Button>
                            </div>
                        )} */}

                    </CardContent>
                </Card>
                <Card variant="outlined" sx={{
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #ffd700',
                    borderRadius: 2
                }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ color: '#ffd700' }}>Notifications</Typography>
                        <Notifications />
                    </CardContent>
                </Card>
            </Stack>
        </Container >
    );
}