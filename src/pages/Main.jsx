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
    const [serviceMode, setServiceMode] = useState('free');

    const navigate = useNavigate();

    const load = async () => {

        try {
            // Direct API call to JSON Server
            let response;

            // fetch data if no data fetched before or last fetch was over 1.5 minutes ago
            let lastDataFetchTooOld = !localStorage.getItem('lastDataFetch') ||
                (Date.now() - parseInt(localStorage.getItem('lastDataFetch') || "0", 10) > 1.5 * 60 * 1000);

            if (lastDataFetchTooOld) {
                response = await api.post(`${API_URL}/api/user`, {
                    username: userData.username,
                    email: userData.email,
                    password: localStorage.getItem('passwordtxt')
                });

                if (response.status === 200 && response.data) {
                    console.log("User profile response data:", response.data);
                    localStorage.setItem('Earnings', JSON.stringify(response.data.earnings || []));
                    localStorage.setItem('Unlocks', JSON.stringify(response.data.unlocks || []));
                    localStorage.setItem('userdata', JSON.stringify(response.data.user || {}));
                    localStorage.setItem('lastDataFetch', Date.now().toString()); // Set account type
                    setBalance(response.data.user?.credits || 0); // Use credits from userData or fallback
                } else {
                    throw new Error('Failed to fetch wallet data');
                }
            } else {
                // Use cached data if not fetching new data
                const cachedUser = JSON.parse(localStorage.getItem('userdata') || '{}');
                setBalance(cachedUser.credits || 0);
            }
        } catch (e) {
            console.error('Error loading wallet balance:', e);
            setBalance(750); // demo fallback with realistic amount
            // clear local storage
            localStorage.clear();
            navigate('/info');
            setTimeout(() => { navigate('/login'); }, 15000); // Redirect to login after 15 seconds
        }

    };

    useEffect(() => { load(); }, []);

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
                        <Typography variant="h6" sx={{ color: '#ffd700', mb: 3 }}>What do you want to do?</Typography>

                        {/* create buttons for modes for services: free, basic, standard, premium */}
                        <div style={{ display: 'flex', gap: '16px', mb: 2 }}>
                            <Typography variant="h6" sx={{ color: '#ccc', alignSelf: 'center' }}>Mode:</Typography>
                            <Button variant="outlined" sx={{ color: '#ffd700', borderColor: '#ffd700' }} onClick={() => setServiceMode('free')}>
                                Free
                            </Button>
                            <Button variant="outlined" sx={{ color: '#ffd700', borderColor: '#ffd700' }} onClick={() => setServiceMode('basic')}>
                                Basic
                            </Button>
                            <Button variant="outlined" sx={{ color: '#ffd700', borderColor: '#ffd700' }} onClick={() => setServiceMode('standard')}>
                                Standard
                            </Button>
                            <Button variant="outlined" sx={{ color: '#ffd700', borderColor: '#ffd700' }} onClick={() => setServiceMode('premium')}>
                                Premium
                            </Button>
                        </div>
                        <Divider sx={{ my: 2, borderColor: '#444' }} />
                        {/* Services Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '16px'
                        }}>
                            {/* Scramble Video Service */}
                            {(serviceMode === 'free' || serviceMode === 'basic') && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #2e7d32',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#2e7d32',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/video-scrambler")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#2e7d32', mb: 1, fontWeight: 'bold' }}>
                                            🎬 Scramble Video ({serviceMode === 'free' ? 'Free' : 'No Ads'})
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Upload and scramble videos into unrecognizable tiles. Generate keys to monetize access to your content.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Scramble Photo Service */}
                            {(serviceMode === 'free' || serviceMode === 'basic') && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #2e7d32',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#2e7d32',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/photo-scrambler")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#2e7d32', mb: 1, fontWeight: 'bold' }}>
                                            📸 Scramble Photo ({serviceMode === 'free' ? 'Free' : 'No Ads'})
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Protect your images by scrambling them with watermarks and metadata headers for secure sharing.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Scramble Photo Service */}
                            {(serviceMode === 'premium' || serviceMode === 'standard') && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #2e7d32',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#2e7d32',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/photo-scrambler-pro")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#2e7d32', mb: 1, fontWeight: 'bold' }}>
                                            🔐📸 Scramble Photo Pro
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Protect your images by scrambling them with watermarks and metadata headers for secure sharing.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Encode Mode Service */}
                            {/* <Card sx={{
                                backgroundColor: '#2a2a2a',
                                border: '1px solid #2e7d32',
                                borderRadius: 2,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    backgroundColor: '#2e7d32',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)'
                                }
                            }}
                                onClick={() => navigate("/encode-mode")}>
                                <CardContent sx={{ p: 2 }}>
                                    <Typography variant="h6" sx={{ color: '#2e7d32', mb: 1, fontWeight: 'bold' }}>
                                        🔐 Encode Mode
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                        Advanced encoding features for creating secure, encrypted content with custom algorithms.
                                    </Typography>
                                </CardContent>
                            </Card> */}

                            {/* Free Services */}

                            {/* Unscramble Video Service */}
                            {(serviceMode === 'free' || serviceMode === 'basic') && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #ff9800',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#ff9800',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/video-unscrambler")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#ff9800', mb: 1, fontWeight: 'bold' }}>
                                            🔓🎬 Unscramble Video ({serviceMode === 'free' ? 'Free' : 'No Ads'})
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Use your keys to unscramble videos back to their original form. Restore scrambled content.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Unscramble Photo Service */}
                            {(serviceMode === 'free' || serviceMode === 'basic') && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #ff9800',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#ff9800',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/photo-unscrambler")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#ff9800', mb: 1, fontWeight: 'bold' }}>
                                            🖼️ Unscramble Photo ({serviceMode === 'free' ? 'Free' : 'No Ads'})
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Restore scrambled images using unscramble keys. View protected photos in their original form.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Pro Services */}

                  

                            {/* Pro Unscramble Photo Service */}
                            {(serviceMode === 'premium' || serviceMode === 'standard') && (

                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #ff9800',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#ff9800',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/photo-unscrambler-pro")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#ff9800', mb: 1, fontWeight: 'bold' }}>
                                            🖼️ Unscramble Photo (Pro)
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Restore scrambled images using unscramble keys. View protected photos in their original form.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Pro Scramble Video Service */}
                            {(serviceMode === 'premium' || serviceMode === 'standard') && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #2e7d32',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#2e7d32',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/video-scrambler-pro")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#2e7d32', mb: 1, fontWeight: 'bold' }}>
                                          🔐🎬 Scramble Video (Pro)
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Upload and scramble videos into unrecognizable tiles. Generate keys to monetize access to your content.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Pro Unscramble Video Service */}
                            {( serviceMode === 'premium' || serviceMode === 'standard') && (

                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #ff9800',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#ff9800',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/video-unscrambler-pro")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#ff9800', mb: 1, fontWeight: 'bold' }}>
                                           🎬 Unscramble Video (Pro)  
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Restore scrambled videos using unscramble keys. View protected content in its original form.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )} 


                            {/* Photo Leak Checker Service */}
                            {serviceMode === 'premium' && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #e91e63',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#e91e63',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(233, 30, 99, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/photo-leak-checker")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#e91e63', mb: 1, fontWeight: 'bold' }}>
                                            🔍 Photo Leak Scanner
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Scan and detect if your images have been leaked or shared without permission online.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Video Leak Checker Service */}
                            {serviceMode === 'premium' && (
                                <Card sx={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #e91e63',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#e91e63',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(233, 30, 99, 0.3)'
                                    }
                                }}
                                    onClick={() => navigate("/video-leak-checker")}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#e91e63', mb: 1, fontWeight: 'bold' }}>
                                            🎥 Video Leak Scanner
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.4 }}>
                                            Monitor and check if your videos have been leaked or distributed without authorization.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}


                        </div>
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