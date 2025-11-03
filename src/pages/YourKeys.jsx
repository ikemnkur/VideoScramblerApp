import React, { useEffect, useState } from 'react';
import { 
  Container, Typography, Stack, Skeleton, Grid2 as Grid,
  Box, CircularProgress, Paper, TextField, Button, InputAdornment,
  Select, MenuItem, Chip, TableContainer, Table, TableHead, 
  TableRow, TableCell, TableBody, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Card, CardContent, CardMedia, Link, Snackbar
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Visibility,
  Share as ShareIcon,
  Delete as DeleteIcon 
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import KeyCard from '../components/KeyCard';
import KeyRevealDialog from '../components/KeyRevealDialog';
import { useToast } from '../contexts/ToastContext';

// Function to fetch user's unlocked keys from localStorage
const fetchUserKeys = async () => {
  try {
    // Get unlocked keys from localStorage (this would be populated when user unlocks keys)
    const unlockedKeys = JSON.parse(localStorage.getItem('unlockedKeys') || '[]');
    
    // If no keys exist, provide some sample data for demonstration
    if (unlockedKeys.length === 0) {
      const sampleKeys = [
        {
          id: '1',
          title: 'Windows Pro License Key',
          key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
          type: 'text',
          host: 'TechDealer',
          price_credits: 250,
          unlocked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          reference_id: 'ref-001',
          description: 'Genuine Windows Pro retail license key'
        },
        {
          id: '2', 
          title: 'Steam Game Code',
          key: 'STEAM-XXXX-YYYY-ZZZZ',
          type: 'text',
          host: 'GameVault',
          price_credits: 120,
          unlocked_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          reference_id: 'ref-002',
          description: 'Popular indie game activation code'
        },
        {
          id: '3',
          title: 'Archive Password',
          key: 'SecretPassword123!',
          type: 'text', 
          host: 'DataVault',
          price_credits: 75,
          unlocked_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
          reference_id: 'ref-003',
          description: 'Password for encrypted archive file'
        }
      ];
      
      // Store sample data for demonstration
      localStorage.setItem('unlockedKeys', JSON.stringify(sampleKeys));
      return sampleKeys.map(key => ({
        id: key.id,
        title: key.title,
        content: key.key,
        type: key.type,
        host_username: key.host,
        cost: key.price_credits,
        created_at: key.unlocked_at,
        reference_id: key.reference_id,
        description: key.description
      }));
    }
    
    // Transform the data to match the expected format
    return unlockedKeys.map(key => ({
      id: key.id || Math.random().toString(36).substr(2, 9),
      title: key.title || 'Unlocked Key',
      content: key.key || key.value || 'Hidden content',
      type: key.type || 'text',
      host_username: key.host || 'Unknown',
      cost: key.price_credits || 0,
      created_at: key.unlocked_at || new Date().toISOString(),
      reference_id: key.reference_id || key.id,
      description: key.description || ''
    }));
  } catch (error) {
    console.error('Error fetching unlocked keys:', error);
    return [];
  }
};


const YourKeys = () => {
  const navigate = useNavigate();

  const [searchTermContent, setSearchTermContent] = useState('');
  const [searchTermSub, setSearchTermSub] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [action, setAction] = useState('');
  const [walletData, setWalletData] = useState(null);
  const [contentList, setContentList] = useState([]);
  const [filteredContent, setFilteredContent] = useState([]);
  // const [subscriptionList, setSubscriptionList] = useState([]);
  // const [filteredSubs, setFilteredSubs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewingContent, setViewingContent] = useState(null);



  useEffect(() => {
    const loadAll = async () => {
      try {
        const [content, subs] = await Promise.all([fetchUserKeys()]);
        setContentList(content || []);
        setFilteredContent(content || []);
        // setSubscriptionList(subs || []);
        // setFilteredSubs(subs || []);
      } catch (err) {
        console.error('Failed to load data', err);
        setError('Failed to load your content/subscriptions.');
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();


  }, []);

  const searchKeys = () => {
    const term = searchTermContent.toLowerCase();
    setFilteredContent(
      contentList.filter(
        (i) =>
          String(i.title || '').toLowerCase().includes(term) ||
          String(i.host_username || '').toLowerCase().includes(term) ||
          String(i.type || '').toLowerCase().includes(term)
      )
    );
  };

  const handleSearchKeys = (e) => {
    e?.preventDefault?.();
    searchKeys();
  };



  const sortContent = (rows) => {
    const sorted = [...rows].sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case 'date':
          av = new Date(a.created_at);
          bv = new Date(b.created_at);
          break;
        case 'amount':
          av = parseFloat(a.cost);
          bv = parseFloat(b.cost);
          break;
        case 'username':
          av = String(a.host_username || '').toLowerCase();
          bv = String(b.host_username || '').toLowerCase();
          break;
        default:
          av = a.id;
          bv = b.id;
      }
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const contentToDisplay = sortContent(filteredContent);
  // const subsToDisplay = sortContent(filteredSubs);

  const handleViewContent = (item) => {
    setViewingContent(item);
    setOpenViewDialog(true);
  };

  const handleCloseViewDialog = () => {
    setOpenViewDialog(false);
    setViewingContent(null);
  };

  const renderContentPreview = (content) => {
    if (!content) return null;

    // Extract safely
    let contentData;
    if (typeof content.content === 'object' && content.content !== null) {
      contentData = content.content.content || JSON.stringify(content.content);
    } else {
      contentData = content.content || content;
    }
    if (typeof contentData === 'object') contentData = JSON.stringify(contentData);

    switch (content.type) {
     
      case 'text':
      default:
        return (
          <Card sx={{ 
            maxWidth: '100%', 
            mb: 2, 
            backgroundColor: '#2a2a2a',
            border: '1px solid #555'
          }}>
            <CardContent>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }} gutterBottom>Unlocked Content:</Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  whiteSpace: 'pre-wrap', 
                  color: '#e0e0e0',
                  backgroundColor: '#1a1a1a',
                  p: 2,
                  borderRadius: 1,
                  fontFamily: 'monospace'
                }}
              >
                {String(contentData)}
              </Typography>
            </CardContent>
          </Card>
        );
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0a0a'
      }}>
        <CircularProgress sx={{ color: '#ffd700' }} />
      </Box>
    );
  }
  if (error) return (
    <Box sx={{ 
      backgroundColor: '#0a0a0a', 
      minHeight: '100vh', 
      p: 3, 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <Typography color="error">{error}</Typography>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', backgroundColor: '#0a0a0a', minHeight: '100vh', p: 3 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            color: '#ffd700',
            mb: 1,
          }}
        >
          Your Keys
        </Typography>
        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
          View your unlocked Keys
        </Typography>
      </Box>

      {/* Unlocked Content */}
      <Paper sx={{ 
        p: { xs: 2, md: 3 }, 
        mb: 3, 
        backgroundColor: '#1a1a1a', 
        border: '2px solid #ffd700',
        borderRadius: 2 
      }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0 }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: '#ffd700' }}>Your Unlock Keys</Typography>
        </Box>

      


        <Box
          component="form"
          onSubmit={handleSearchKeys}
          sx={{
            position: 'relative',
            mb: 2,
            p: { xs: 0.5, sm: 1 },
          }}
        >
          {/* Row 1: Search input + Search button */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'nowrap',
              width: '100%',
              mb: 1,
            }}
          >
             <TextField
              label="Search content"
              value={searchTermContent}
              onChange={(e) => setSearchTermContent(e.target.value)}
              size="small"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2a2a2a',
                  '& fieldset': { borderColor: '#555' },
                  '&:hover fieldset': { borderColor: '#ffd700' },
                  '&.Mui-focused fieldset': { borderColor: '#ffd700' },
                  color: '#e0e0e0'
                },
                '& .MuiInputLabel-root': { color: '#b0b0b0' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ffd700' }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon sx={{ color: '#ffd700' }} /></InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              sx={{
                textTransform: 'none',
                flexBasis: '15%',
                minWidth: 0,
                px: 2,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                backgroundColor: '#2e7d32',
                '&:hover': { backgroundColor: '#388e3c' }
              }}
            >
              Search
            </Button>
          </Box>
          <Box
            sx={{
              mt: 1.5,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'space-between'
            }}
          >
            {/* Left side: Filters + Item count */}
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                flex: 1
              }}
            >
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                size="small"
                sx={{ 
                  minWidth: 100,
                  backgroundColor: '#2a2a2a',
                  color: '#e0e0e0',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' }
                }}
              >
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="amount">Amount</MenuItem>
                <MenuItem value="username">Username</MenuItem>
              </Select>

              <Select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                size="small"
                sx={{ 
                  minWidth: 100,
                  backgroundColor: '#2a2a2a',
                  color: '#e0e0e0',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' }
                }}
              >
                <MenuItem value="asc">Ascending</MenuItem>
                <MenuItem value="desc">Descending</MenuItem>
              </Select>

              {/* Chip pinned to the top-right */}
              <Chip
                label={`${contentToDisplay.length} item${contentToDisplay.length === 1 ? '' : 's'}`}
                variant="outlined"
                sx={{ 
                  marginRight: "1%",
                  borderColor: '#ffd700',
                  color: '#ffd700',
                  backgroundColor: '#2a2a2a'
                }}
              // sx={{ position: 'absolute', top: 8, right: 8 }}
              />


              {/* Reset button (commented out like in your example) */}
              {/* <Button
                variant="text"
                sx={{ textTransform: 'none' }}
                onClick={handleReset}
              >
                Reset
              </Button> */}
            </Box>


          </Box>
        </Box>

        <TableContainer component={Paper} sx={{ 
          maxHeight: { xs: 360, md: 480 }, 
          overflowY: 'auto', 
          borderRadius: 1,
          backgroundColor: '#2a2a2a'
        }}>
          <Table stickyHeader>
            <TableHead sx={{ 
              '& .MuiTableCell-stickyHeader': { 
                backgroundColor: '#1a1a1a !important', 
                fontWeight: 600,
                color: '#ffd700',
                borderBottom: '2px solid #ffd700'
              } 
            }}>
              <TableRow>
                <TableCell sx={{ color: '#ffd700' }}>Title</TableCell>
                <TableCell sx={{ color: '#ffd700' }}>Date</TableCell>
                {/* <TableCell>Type</TableCell> */}
                <TableCell sx={{ color: '#ffd700' }}>Host User</TableCell>
                <TableCell sx={{ color: '#ffd700' }}>Cost</TableCell>
                <TableCell align="center" sx={{ color: '#ffd700' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contentToDisplay.map((item) => (
                <TableRow key={item.id} hover sx={{ 
                  '&:hover': { backgroundColor: '#333' },
                  backgroundColor: '#2a2a2a'
                }}>
                  <TableCell sx={{ color: '#e0e0e0', borderBottom: '1px solid #444' }}>{item.title}</TableCell>
                  <TableCell sx={{ color: '#e0e0e0', borderBottom: '1px solid #444' }}>{item.created_at.slice(0, 10)}</TableCell>
                  {/* <TableCell>{item.type}</TableCell> */}
                  <TableCell sx={{ color: '#e0e0e0', borderBottom: '1px solid #444' }}>{item.host_username}</TableCell>
                  <TableCell sx={{ color: '#2e7d32', fontWeight: 'bold', borderBottom: '1px solid #444' }}>₡{item.cost}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap', borderBottom: '1px solid #444' }}>
                    <Tooltip title="View">
                      <IconButton 
                        onClick={() => handleViewContent(item)} 
                        size="small"
                        sx={{ color: '#ffd700', '&:hover': { backgroundColor: '#444' } }}
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {/* <Tooltip title="Share">
                      <IconButton onClick={() => { setShareLink(`${siteURL}/unlock/${item.reference_id}`); setOpenShareDialog(true); }} size="small"><ShareIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton onClick={() => handleDeleteUserContent(item.id)} size="small"><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip> */}
                  </TableCell>
                </TableRow>
              ))}
              {contentToDisplay.length === 0 && (
                <TableRow>
                  <TableCell 
                    colSpan={6} 
                    align="center" 
                    sx={{ 
                      color: '#b0b0b0', 
                      fontStyle: 'italic',
                      borderBottom: '1px solid #444',
                      py: 4
                    }}
                  >
                    No unlocked keys found. Purchase and unlock keys to see them here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

     

      {/* View Content Dialog */}
      <Dialog 
        open={openViewDialog} 
        onClose={handleCloseViewDialog} 
        fullWidth 
        maxWidth="sm" 
        PaperProps={{ 
          sx: { 
            borderRadius: 2, 
            backgroundColor: '#1a1a1a',
            border: '2px solid #ffd700'
          } 
        }}
      >
        <DialogTitle sx={{ color: '#ffd700', borderBottom: '1px solid #444' }}>
          {viewingContent?.title}
        </DialogTitle>
        <DialogContent dividers sx={{ backgroundColor: '#1a1a1a' }}>
          <DialogContentText sx={{ mb: 2, color: '#b0b0b0' }}>Preview</DialogContentText>
          {renderContentPreview(viewingContent)}
          <Paper variant="outlined" sx={{ 
            p: 2, 
            backgroundColor: '#2a2a2a',
            border: '1px solid #555'
          }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Host User:</Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0' }}>{viewingContent?.host_username}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Cost:</Typography>
                <Typography variant="body1" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>₡{viewingContent?.cost}</Typography>
              </Box>
            </Box>
            {viewingContent?.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Description:</Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0' }}>{viewingContent.description}</Typography>
              </Box>
            )}
          </Paper>
        </DialogContent>
        
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={openShareDialog} onClose={() => setOpenShareDialog(false)} PaperProps={{ sx: { borderRadius: 2, p: 1 } }}>
        <DialogTitle>Share this item</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <DialogContentText>Scan or copy the link below:</DialogContentText>
          {shareLink && (
            <>
              <Box sx={{ my: 2, display: 'flex', justifyContent: 'center' }}>
                <QRCode value={shareLink} size={240} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                <Clipboard Item={shareLink} />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenShareDialog(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Legacy confirm dialog preserved if you still use action */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>{action === 'reload' ? 'Reload Wallet' : 'Withdraw Funds'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {action === 'reload' ? 'reload your wallet' : 'withdraw funds'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button autoFocus>Confirm</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={false}
        autoHideDuration={6000}
        onClose={() => { }}
        message=""
      />
    </Box>
  );
};


export default YourKeys;