import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Typography,
    Paper,
    Box,
    CircularProgress,
    Snackbar,
    Button,
    Modal,
    TextField,
    Select,
    MenuItem,
    Divider,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody
} from '@mui/material';
// import { fetchInfoData, fetchUserProfile } from './api';
// import Notifications from './Notifications';
// import { useParams } from 'react-router-dom';
// import { fetchDisplayAds } from './api';
// import AdObject from '../pages/AdObject'; // Adjust path as needed
// import AdVideoObject from '../pages/AdVideoObject'; // Adjust path as needed

const Info = () => {
    const navigate = useNavigate();

    // Component state
    const [InfoData, setInfoData] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [userData, setUserData] = useState({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        birthDate: '',
        encryptionKey: '',
        accountTier: 1,
        profilePicture: null
    });
    const [tier, setTier] = useState(true);

    // New state for modal and FAQ search
    const [openPopupAdModal, setOpenPopupAdModal] = useState(false);
    const [popupAdContent, setPopupAdContent] = useState(null);
    const [openSupportModal, setOpenSupportModal] = useState(false);
    const [supportUsername, setSupportUsername] = useState('');
    const [supportProblemType, setSupportProblemType] = useState('');
    const [supportMessage, setSupportMessage] = useState('');
    const [supportTitle, setSupportTitle] = useState('');
    const [supportContactInfo, setSupportContactInfo] = useState('');
    const [faqSearch, setFaqSearch] = useState('');

    // Ref for seeking to timestamps in videos
    const howToVideoRef = useRef(null);

    //   // Load user profile
    //   useEffect(() => {
    //     const loadUserProfile = async () => {
    //       try {
    //         const profileRes = await fetchUserProfile();
    //         setProfile(profileRes);
    //         const updatedUserData = {
    //           ...profileRes,
    //           birthDate: profileRes.birthDate ? profileRes.birthDate.split('T')[0] : '',
    //         };
    //         setUserData(updatedUserData);
    //         localStorage.setItem('userdata', JSON.stringify(updatedUserData));
    //         setTier(parseInt(profileRes.accountTier));
    //       } catch (err) {
    //         console.error('Error fetching user profile:', err);
    //         setSnackbarMessage(
    //           err.response?.data?.message ||
    //           'Failed to load user profile, please refresh or login again'
    //         );
    //         setOpenSnackbar(true);
    //         // if (err.response?.status === 401) {
    //         // setTimeout(() => navigate('/login'), 500);
    //         // }
    //       }
    //     };
    //     loadUserProfile();
    //   }, [navigate]);

    // Load info data
    useEffect(() => {
        const loadInfoData = async () => {
            try {
                // Placeholder: const data = await fetchInfoData();
                // setInfoData(data);
                if(window.location.href.includes("info")){
                    // do nothing
                } else {
                    let loggedIn = (localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')).loginStatus : false);
                    if (loggedIn) window.location.reload(true);
                }
                
            } catch (err) {
                setTimeout(() => navigate('/login'), 500);
                setError('Failed to load data, Please Re-Login');
            } finally {
                setIsLoading(false);
            }
        };
        loadInfoData();
    }, [navigate]);

    // Handle video seek (placeholder)
    const handleSeekTo = (seconds) => {
        if (howToVideoRef.current) {
            console.log(`Seeking to ${seconds} seconds (placeholder)`);
        }
    };

    // Modal open/close
    const handleOpenSupportModal = () => setOpenSupportModal(true);
    const handleCloseSupportModal = () => setOpenSupportModal(false);
    const handleOpenPopupAdModal = () => setOpenPopupAdModal(true);
    const handleClosePopupAdModal = () => setOpenPopupAdModal(false);

    // Display and auto-close popup ad modal using useEffect
    useEffect(() => {
        const openTimer = setTimeout(() => {
            handleOpenPopupAdModal();
        }, 10000);

        const closeTimer = setTimeout(() => {
            setOpenPopupAdModal(false);
        }, 20000);

        return () => {
            clearTimeout(openTimer);
            clearTimeout(closeTimer);
        };
    }, []);

    // Submit support ticket form (placeholder)
    const handleSubmitSupportTicket = () => {
        console.log('Submitting support ticket with:', {
            supportProblemType,
            supportTitle,
            supportMessage,
            supportContactInfo,
            supportUsername: userData.username || supportUsername,
            supportUserId: userData.id || "0" // Fallback to 0 if userData is not available
        });
        setSupportProblemType('');
        setSupportTitle('');
        setSupportMessage('');
        setSupportContactInfo('');
        setOpenSupportModal(false);
        setSnackbarMessage('Support ticket submitted (placeholder)');
        setOpenSnackbar(true);
    };

    // FAQ search (placeholder)
    const handleFaqSearch = () => {
        console.log('Searching FAQ with:', faqSearch);
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Box
            sx={{
                p: { xs: 2, md: 4 },
                maxWidth: '1200px',
                mx: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: '100vh',
                backgroundColor: '#0a0a0a', // Deep black background
                color: '#ffffff', // White text
            }}
        >

            <Typography
                variant="h4"
                align="center"
                gutterBottom
                sx={{
                    color: '#ffd700', // Gold/yellow text
                    fontWeight: 'bold',
                    textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                    mb: 4
                }}
            >
                Welcome to Video Scrambler!
            </Typography>

            {/* Main Sections */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
                {/* Explanation Section */}
                <Paper sx={{
                    flex: 1,
                    p: 3,
                    backgroundColor: '#1a1a1a', // Dark background
                    color: '#ffffff', // White text
                    border: '1px solid #ffd700', // Gold border
                    boxShadow: '0 4px 20px rgba(255, 215, 0, 0.2)',
                }}>
                    <Typography
                        variant="h5"
                        gutterBottom
                        sx={{
                            color: '#00e676', // Green accent for headings
                            fontWeight: 'bold',
                            mb: 3
                        }}
                    >
                        What is Video Scrambler
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            mb: 2,
                            color: '#e0e0e0', // Light gray text for readability
                            lineHeight: 1.6
                        }}
                    >
                        Video Scrambler is a platform that allows users to buy and sell digital keys securely and efficiently.
                    </Typography>
                    <Box
                        sx={{
                            position: 'relative',
                            paddingBottom: '56.25%',
                            height: 0,
                            overflow: 'hidden',
                            mb: 2,
                        }}
                    >
                        <iframe
                            src="https://www.youtube.com/embed/Q_KxEMxn2pc"
                            title="Intro Video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                        ></iframe>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                        {/* <Button variant="outlined" onClick={() => navigate('/register')}>
              Try Clout Coin
            </Button> */}
                        <Button
                            variant="outlined"
                            onClick={() => navigate('/login')}
                            sx={{
                                borderColor: '#ffd700',
                                color: '#ffd700',
                                '&:hover': {
                                    borderColor: '#ffed4e',
                                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                                    color: '#ffed4e'
                                }
                            }}
                        >
                            Log In to Video Scrambler
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => navigate('/main')}
                            sx={{
                                borderColor: '#00e676',
                                color: '#00e676',
                                '&:hover': {
                                    borderColor: '#00c853',
                                    backgroundColor: 'rgba(0, 230, 118, 0.1)',
                                    color: '#00c853'
                                }
                            }}
                        >
                            Go to Dashboard
                        </Button>
                    </Box>
                </Paper>

                {/* News Section */}
                <Paper sx={{
                    flex: 1,
                    p: 3,
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    border: '1px solid #ffd700',
                    boxShadow: '0 4px 20px rgba(255, 215, 0, 0.2)',
                }}>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{
                            color: '#00e676',
                            fontWeight: 'bold',
                            mb: 2
                        }}
                    >
                        News
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            mb: 2,
                            color: '#e0e0e0',
                            lineHeight: 1.6
                        }}
                    >
                        Welcome to our News & Info page! Here, you can share the latest updates, announcements,
                        or articles. Customize this section with any relevant text or images you need.
                    </Typography>
                    <Box
                        sx={{
                            position: 'relative',
                            paddingBottom: '56.25%',
                            height: 0,
                            overflow: 'hidden',
                        }}
                    >
                        <iframe
                            src="https://www.youtube.com/embed/Q_KxEMxn2pc"
                            title="News Video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                        ></iframe>
                    </Box>
                </Paper>

                {/* How to Use Section */}
                <Paper sx={{
                    flex: 1,
                    p: 3,
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    border: '1px solid #ffd700',
                    boxShadow: '0 4px 20px rgba(255, 215, 0, 0.2)',
                }}>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{
                            color: '#00e676',
                            fontWeight: 'bold',
                            mb: 2
                        }}
                    >
                        How to Use
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography
                            variant="body1"
                            sx={{
                                mb: 1,
                                color: '#e0e0e0',
                                lineHeight: 1.6
                            }}
                        >
                            Below is a quick tutorial video on how to use Video Scrambler. You can click "Go" next to
                            each section to jump to that part of the video.
                        </Typography>

                        <Box
                            sx={{
                                position: 'relative',
                                paddingBottom: '56.25%',
                                height: 0,
                                overflow: 'hidden',
                                mt: 2,
                            }}
                        >
                            <iframe
                                ref={howToVideoRef}
                                src="https://www.youtube.com/embed/Q_KxEMxn2pc"
                                title="How-to Video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                            ></iframe>
                        </Box>
                        <Divider sx={{ backgroundColor: '#ffd700', opacity: 0.7 }} />
                        <Typography
                            variant="h6"
                            sx={{ color: '#ffd700', fontWeight: 'bold' }}
                        >
                            <Button
                                variant="text"
                                onClick={() => handleSeekTo(60)}
                                sx={{
                                    color: '#00e676',
                                    fontWeight: 'bold',
                                    '&:hover': { backgroundColor: 'rgba(0, 230, 118, 0.1)' }
                                }}
                            >
                                Go
                            </Button> • Buyers
                        </Typography>
                        {/* List of sections with "Go" buttons */}
                        <Typography
                            variant="body2"
                            sx={{ color: '#e0e0e0' }}
                        >
                            <Button
                                variant="text"
                                onClick={() => handleSeekTo(10)}
                                sx={{
                                    color: '#00e676',
                                    '&:hover': { backgroundColor: 'rgba(0, 230, 118, 0.1)' }
                                }}
                            >
                                Go
                            </Button> • Buying Credits
                        </Typography>

                        <Typography
                            variant="body2"
                            sx={{ color: '#e0e0e0' }}
                        >
                            <Button
                                variant="text"
                                onClick={() => handleSeekTo(35)}
                                sx={{
                                    color: '#00e676',
                                    '&:hover': { backgroundColor: 'rgba(0, 230, 118, 0.1)' }
                                }}
                            >
                                Go
                            </Button> • Unlocking Keys
                        </Typography>

                        <Divider sx={{ backgroundColor: '#ffd700', opacity: 0.7 }} />
                        <Typography
                            variant="h6"
                            sx={{ color: '#ffd700', fontWeight: 'bold' }}
                        >
                            <Button
                                variant="text"
                                onClick={() => handleSeekTo(60)}
                                sx={{
                                    color: '#00e676',
                                    fontWeight: 'bold',
                                    '&:hover': { backgroundColor: 'rgba(0, 230, 118, 0.1)' }
                                }}
                            >
                                Go
                            </Button> • Sellers
                        </Typography>
                        {/* <Divider sx={{ backgroundColor: '#ffd700', opacity: 0.7 }} /> */}
                        <Typography
                            variant="body2"
                            sx={{ color: '#e0e0e0' }}
                        >
                            <Button
                                variant="text"
                                onClick={() => handleSeekTo(45)}
                                sx={{
                                    color: '#00e676',
                                    '&:hover': { backgroundColor: 'rgba(0, 230, 118, 0.1)' }
                                }}
                            >
                                Go
                            </Button> • Creating Your Own Keys
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ color: '#e0e0e0' }}
                        >
                            <Button
                                variant="text"
                                onClick={() => handleSeekTo(20)}
                                sx={{
                                    color: '#00e676',
                                    '&:hover': { backgroundColor: 'rgba(0, 230, 118, 0.1)' }
                                }}
                            >
                                Go
                            </Button> • Redeeming Earned Credits
                        </Typography>
                    </Box>

                </Paper>
            </Box>

            {/* Support Section */}
            <Box
                sx={{
                    textAlign: 'center',
                    backgroundColor: '#1a1a1a',
                    p: 4,
                    borderRadius: 2,
                    border: '1px solid #ffd700',
                    boxShadow: '0 4px 20px rgba(255, 215, 0, 0.2)',
                }}
            >
                <Typography
                    variant="h4"
                    gutterBottom
                    sx={{
                        color: '#ffd700',
                        fontWeight: 'bold',
                        textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                        mb: 3
                    }}
                >
                    Tell us what you think! Give us Feedback?
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Typography
                        variant="body1"
                        sx={{ color: '#e0e0e0' }}
                    >
                        Submit a feedback ticket
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleOpenSupportModal}
                        sx={{
                            backgroundColor: '#00e676',
                            color: '#000000',
                            fontWeight: 'bold',
                            '&:hover': {
                                backgroundColor: '#00c853',
                                boxShadow: '0 0 15px rgba(0, 230, 118, 0.5)'
                            }
                        }}
                    >
                        Feedback
                    </Button>
                </Box>
            </Box>


            {/* Advertisement Section */}
            {/* <Paper
        elevation={1}
        sx={{
          p: 0, // Remove padding to let AdObject handle its own spacing
          mt: 2,
          overflow: 'hidden', // Prevent content overflow
          borderRadius: 2
        }}
      >
        <Box sx={{ p: 1, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
            Advertisement
          </Typography>
        </Box>

        {/* AdObject Component */}
            {/* <AdObject
          onAdView={(ad) => console.log('Ad viewed:', ad)}
          onAdClick={(ad) => console.log('Ad clicked:', ad)}
          onAdSkip={(ad) => console.log('Ad skipped:', ad)}
          onRewardClaim={(ad, amount) => console.log('Reward claimed:', amount)}
          RewardModal={({ onClose, onReward }) => (
            <div style={{ }}>
              <button onClick={() => onReward(5)}>Claim Credits</button>
              <button onClick={onClose}>Close</button>
            </div>
          )}
          showRewardProbability={0.1} // 10% chance to show reward button
          filters={{ format: 'video', mediaFormat: 'regular' }} // Only show video ads for this placement
          style={{
            minHeight: '200px', // Ensure minimum height
            borderRadius: 0 // Remove border radius to fit Paper container
          }}
          getAdById={-1}
          className="banner-ad"
        /> */}
            {/* </Paper> */}

            {/* Support Ticket Modal */}
            <Modal
                open={openSupportModal}
                onClose={handleCloseSupportModal}
                aria-labelledby="support-modal-title"
                aria-describedby="support-modal-description"
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        bgcolor: '#1a1a1a', // Dark background
                        color: '#ffffff', // White text
                        border: '2px solid #ffd700', // Gold border
                        boxShadow: '0 8px 32px rgba(255, 215, 0, 0.3)',
                        p: 4,
                        width: { xs: '90%', sm: '400px' },
                        borderRadius: 2,
                    }}
                >
                    <Typography
                        id="support-modal-title"
                        variant="h6"
                        gutterBottom
                        sx={{
                            color: '#ffd700',
                            fontWeight: 'bold',
                            mb: 3
                        }}
                    >
                        Submit Feedback
                    </Typography>
                    <Select
                        fullWidth
                        value={supportProblemType}
                        onChange={(e) => setSupportProblemType(e.target.value)}
                        displayEmpty
                        sx={{
                            mb: 2,
                            backgroundColor: '#2a2a2a',
                            color: '#ffffff',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#ffd700',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#ffed4e',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#ffd700',
                            },
                            '& .MuiSvgIcon-root': {
                                color: '#ffd700',
                            }
                        }}
                    >
                        <MenuItem value="" disabled>
                            Select Feedback Type
                        </MenuItem>
                        <MenuItem value="improvement-issue">Improvement/Tips</MenuItem>
                        <MenuItem value="account-issue">Bugs/App Issues</MenuItem>
                        <MenuItem value="account-issue">Account Issue</MenuItem>
                        <MenuItem value="billing-issue">Billing Issue</MenuItem>
                        <MenuItem value="report-scammer">Report Scammer/Abuse</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                    </Select>
                    <TextField
                        label="Title"
                        fullWidth
                        value={supportTitle}
                        onChange={(e) => setSupportTitle(e.target.value)}
                        sx={{
                            mb: 2,
                            '& .MuiInputLabel-root': { color: '#ffd700' },
                            '& .MuiInputLabel-root.Mui-focused': { color: '#ffd700' },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#2a2a2a',
                                color: '#ffffff',
                                '& fieldset': { borderColor: '#ffd700' },
                                '&:hover fieldset': { borderColor: '#ffed4e' },
                                '&.Mui-focused fieldset': { borderColor: '#ffd700' },
                            }
                        }}
                    />
                    <TextField
                        label="Message"
                        fullWidth
                        multiline
                        rows={3}
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        sx={{
                            mb: 2,
                            '& .MuiInputLabel-root': { color: '#ffd700' },
                            '& .MuiInputLabel-root.Mui-focused': { color: '#ffd700' },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#2a2a2a',
                                color: '#ffffff',
                                '& fieldset': { borderColor: '#ffd700' },
                                '&:hover fieldset': { borderColor: '#ffed4e' },
                                '&.Mui-focused fieldset': { borderColor: '#ffd700' },
                            }
                        }}
                    />
                    <TextField
                        label="Email or Other Contact Info"
                        fullWidth
                        value={supportContactInfo}
                        onChange={(e) => setSupportContactInfo(e.target.value)}
                        sx={{
                            mb: 2,
                            '& .MuiInputLabel-root': { color: '#ffd700' },
                            '& .MuiInputLabel-root.Mui-focused': { color: '#ffd700' },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#2a2a2a',
                                color: '#ffffff',
                                '& fieldset': { borderColor: '#ffd700' },
                                '&:hover fieldset': { borderColor: '#ffed4e' },
                                '&.Mui-focused fieldset': { borderColor: '#ffd700' },
                            }
                        }}
                    />

                    <TextField
                        label="Username"
                        fullWidth
                        value={supportUsername}
                        onChange={(e) => setSupportUsername(e.target.value)}
                        sx={{
                            mb: 2,
                            '& .MuiInputLabel-root': { color: '#ffd700' },
                            '& .MuiInputLabel-root.Mui-focused': { color: '#ffd700' },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#2a2a2a',
                                color: '#ffffff',
                                '& fieldset': { borderColor: '#ffd700' },
                                '&:hover fieldset': { borderColor: '#ffed4e' },
                                '&.Mui-focused fieldset': { borderColor: '#ffd700' },
                            }
                        }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button
                            variant="text"
                            onClick={handleCloseSupportModal}
                            sx={{
                                color: '#e0e0e0',
                                '&:hover': { backgroundColor: 'rgba(224, 224, 224, 0.1)' }
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmitSupportTicket}
                            sx={{
                                backgroundColor: '#00e676',
                                color: '#000000',
                                fontWeight: 'bold',
                                '&:hover': {
                                    backgroundColor: '#00c853',
                                    boxShadow: '0 0 15px rgba(0, 230, 118, 0.5)'
                                }
                            }}
                        >
                            Submit
                        </Button>
                    </Box>
                </Box>
            </Modal>




            {/* Popup Ad Modal */}
            <Modal
                // prevent closing by clicking outside
                disableBackdropClick
                open={openPopupAdModal}
                onClose={handleClosePopupAdModal}
                aria-labelledby="popup-ad-modal-title"
                aria-describedby="popup-ad-modal-description"
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        bgcolor: '#1a1a1a', // Dark background
                        color: '#ffffff', // White text
                        border: '2px solid #ffd700', // Gold border
                        boxShadow: '0 8px 32px rgba(255, 215, 0, 0.3)',
                        p: 2,
                        width: { xs: '90%', sm: '600px' },
                        borderRadius: 2,
                    }}
                >
                    <Typography
                        id="popup-ad-modal-title"
                        variant="h6"
                        gutterBottom
                        sx={{
                            color: '#ffd700',
                            fontWeight: 'bold'
                        }}
                    >
                        Popup Ad
                    </Typography>

                    <canvas
                        id="popupAdCanvas"
                        width="560"
                        height="315"
                        style={{
                            border: '1px solid #ffd700',
                            width: '100%',
                            height: 'auto',
                            backgroundColor: '#0a0a0a'
                        }}
                    >
                        Your browser does not support the canvas element.
                    </canvas>

                    <Typography
                        id="popup-ad-modal-description"
                        variant="body2"
                        sx={{ color: '#e0e0e0', mt: 1 }}
                    >
                        This is a popup ad, it will close automatically after a few seconds.
                    </Typography>
                </Box>
            </Modal>



            {/* Snackbar for notifications */}
            <Snackbar
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                open={openSnackbar}
                autoHideDuration={3000}
                onClose={() => setOpenSnackbar(false)}
                message={snackbarMessage}
            />
        </Box>
    );
};

export default Info;
