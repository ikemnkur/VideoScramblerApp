import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Download as DownloadIcon, Search as SearchIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../api/client';

const SellerTransactions = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Mock data generator for seller transactions
  const generateMockSellerTransactions = () => {
    const transactionTypes = ['Key Sale', 'Earnings Payout', 'Platform Fee', 'Refund'];
    const statuses = ['Completed', 'Processing', 'Pending', 'Failed'];
    const buyers = ['buyer123', 'keycollector', 'gamer456', 'techuser', 'cryptofan'];
    const keyTitles = [
      'Premium Game License Key',
      'Antivirus Software License',
      'Microsoft Office Professional',
      'Adobe Creative Suite',
      'Steam Gift Card Code',
      'Windows 10 Pro License',
      'Spotify Premium Account',
      'Netflix Premium Access',
      'VPN Service Key',
      'Cloud Storage License'
    ];

    const transactions = [];

    for (let i = 1; i <= 50; i++) {
      const transactionType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
      const isEarning = transactionType === 'Key Sale' || transactionType === 'Earnings Payout';
      const isFee = transactionType === 'Platform Fee';
      const isRefund = transactionType === 'Refund';

      const baseCredits = Math.floor(Math.random() * 500) + 50;
      let credits = baseCredits;
      
      // Adjust credits based on transaction type
      if (isFee) {
        credits = Math.floor(baseCredits * 0.1); // 10% platform fee
      } else if (isRefund) {
        credits = -baseCredits; // Negative for refunds
      }

      transactions.push({
        id: i,
        transaction_type: transactionType,
        credits: credits,
        amount_usd: (credits * 0.01).toFixed(2), // Assuming 1 credit = $0.01
        key_title: transactionType === 'Key Sale' ? keyTitles[Math.floor(Math.random() * keyTitles.length)] : null,
        buyer_username: ['Key Sale', 'Refund'].includes(transactionType) 
          ? buyers[Math.floor(Math.random() * buyers.length)] : null,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        message: transactionType === 'Key Sale' 
          ? `Sale of "${keyTitles[Math.floor(Math.random() * keyTitles.length)]}" to ${buyers[Math.floor(Math.random() * buyers.length)]}`
          : transactionType === 'Earnings Payout'
          ? 'Weekly earnings payout to your account'
          : transactionType === 'Platform Fee'
          ? 'Platform commission for successful sales'
          : 'Refund processed for returned key',
        payout_method: transactionType === 'Earnings Payout' 
          ? ['PayPal', 'Bank Transfer', 'Crypto Wallet'][Math.floor(Math.random() * 3)] : null,
        commission_rate: transactionType === 'Platform Fee' ? '10%' : null
      });
    }

    return transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };


  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        
        // Get current user from localStorage
        const userData = JSON.parse(localStorage.getItem("userdata") || '{"username":"seller_123"}');
        const username = userData.username || 'seller_123';
        
        // Fetch earnings data from JSON server
        const response = await api.get(`${API_URL}/api/earnings/${username}?password=${localStorage.getItem("passwordtxt")}`);
        console.log('Earnings API data response:', response.data.earnings);
        
        if (!response.data) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }


//         Earnings API data response: 
// (2) [{…}, {…}]
//         0
// : 
// {id: 'c1d8f874-d27e-4d1e-81fb-7339cf9c32b1', TXnumber: 6, transactionId: '3f4b62e4-a1ea-43fa-8bcc-6dac2ba06c17', username: 'ikemnkur', email: 'ikemnkur@gmail.com', …}
// 1
// : 
// {id: 'da255dea-a875-4377-b226-29b92857ec02', TXnumber: 5, transactionId: '5ea438d2-b9c8-425f-a042-fabedf763fe2', username: 'ikemnkur', email: 'ikemnkur@gmail.com', …}
// length
// : 
// 2
// [[Prototype]]
// : 
// Array(0)


        const allEarnings = response.data && response.data.earnings ? response.data.earnings : [];

        console.log('All earnings:', allEarnings);

        // Filter earnings for current seller
        // const userEarnings = allEarnings.filter(earning => 
        //   earning.username === username
        // );
        const userEarnings = allEarnings; // Since API already filters by username
        
        // Transform earnings data to match transaction format
//         TXnumber
// : 
// 6
// credits
// : 
// 9500
// date
// : 
// 1760116342476
// email
// : 
// "ikemnkur@gmail.com"
// id
// : 
// "c1d8f874-d27e-4d1e-81fb-7339cf9c32b1"
// keyId
// : 
// "key_1760112873530"
// keyTitle
// : 
// "key123"
// keyValue
// : 
// "[\"haha key\"]"
// price
// : 
// 50
// sellerEmail
// : 
// "nobody@gmail.com"
// sellerUsername
// : 
// "Nobody"
// status
// : 
// "Completed"
// time
// : 
// "12:12:22 PM"
// transactionId
// : 
// "3f4b62e4-a1ea-43fa-8bcc-6dac2ba06c17"
// username
// : 
// "ikemnkur"
        const transformedTransactions = userEarnings.map(earning => ({
          id: earning.id,
          transaction_type: "Key Sale", // or use earning.transactionType if available
          credits: Math.abs(earning.price), // Use price for credits
          amount_usd: earning.price.toFixed ? earning.price.toFixed(2) : earning.price, // Format price as USD
          key_title: earning.keyTitle,
          buyer_username: earning.username,
          status: earning.status,
          created_at: new Date(earning.date).toISOString(),
          message: `Key Sale: ${earning.keyTitle || 'N/A'}${earning.username ? ` to ${earning.username}` : ''}`,
          payout_method: null,
          commission_rate: null
        }));
        
        setTransactions(transformedTransactions);
      } catch (err) {
        console.error('Error loading seller transactions:', err);
        setError('Failed to load seller transactions');
        
        // Fallback to mock data if API fails
        const mockData = generateMockSellerTransactions();
        setTransactions(mockData);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, []);

  // Refresh function to reload transactions
  const refreshTransactions = async () => {
    setError(null);
    try {
      setLoading(true);
      
      // Get current user from localStorage
      const userData = JSON.parse(localStorage.getItem("userdata") || '{"username":"seller_123"}');
      const username = userData.username || 'seller_123';
      
      // Fetch earnings data from JSON server
      const response = await fetch(`${API_URL}/api/earnings`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const userEarnings = await response.json();

      // Filter earnings for current seller
      // const userEarnings = allEarnings.filter(earning => 
      //   earning.username === username
      // );
      
      // Transform earnings data to match transaction format
      const transformedTransactions = userEarnings.map(earning => ({
        id: earning.id,
        transaction_type: "unlock",
        credits: Math.abs(earning.price),
        amount_usd: earning.price.toFixed(2),
        key_title: earning.keyTitle,
        buyer_username: earning.username,
        status: earning.status,
        created_at: new Date(earning.date).toISOString(),
        message: `${earning.transactionType}: ${earning.keyTitle || 'N/A'}${earning.username ? ` to ${earning.username}` : ''}`,
        payout_method: earning.transactionType === 'Earnings Payout' ? 'Bank Transfer' : null,
        commission_rate: earning.transactionType === 'Platform Fee' ? '10%' : null
      }));
      
      setTransactions(transformedTransactions);
    } catch (err) {
      console.error('Error refreshing seller transactions:', err);
      setError('Failed to refresh seller transactions');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (t.key_title && t.key_title.toLowerCase().includes(searchLower)) ||
      (t.buyer_username && t.buyer_username.toLowerCase().includes(searchLower)) ||
      t.transaction_type.toLowerCase().includes(searchLower) ||
      t.status.toLowerCase().includes(searchLower) ||
      (t.payout_method && t.payout_method.toLowerCase().includes(searchLower))
    );
  });

  const sortTransactions = (transactionsToSort) => {
    const sorted = [...transactionsToSort].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'created_at') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      } else if (sortField === 'credits') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return sorted;
  };

  const transactionsToDisplay = sortTransactions(filteredTransactions);

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Key/Item', 'Buyer', 'Earnings', 'Status', 'Details'];
    const rows = transactionsToDisplay.map((t) => [
      new Date(t.created_at).toLocaleDateString(),
      t.transaction_type,
      t.key_title || t.payout_method || 'N/A',
      t.buyer_username || 'System',
      `${t.credits} ₡`,
      t.status,
      t.message || ''
    ]);

    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = 'seller-transactions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRowClick = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleCloseModal = () => {
    setSelectedTransaction(null);
  };

  // Calculate summary stats
  const totalEarnings = transactions
    .filter(t => t.transaction_type === 'Key Sale')
    .reduce((sum, t) => sum + (t.credits || 0), 0);

  const totalSales = transactions.filter(t => t.transaction_type === 'Key Sale').length;

  const totalFees = transactions
    .filter(t => t.transaction_type === 'Key Sale')
    .reduce((sum, t) => sum + Math.abs(t.credits || 0) / 10, 0);

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      backgroundColor: '#0a0a0a', 
      minHeight: '100vh',
      color: '#e0e0e0'
    }}>
      {/* Header */}
      <Typography
        variant={isMobile ? 'h5' : 'h4'}
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 'bold',
          color: '#ffd700',
          mb: 3
        }}
      >
        Seller Dashboard
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            '&:hover': { borderColor: '#ffd700' }
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#ffd700', fontSize: '0.9rem' }}>
                Total Earnings
              </Typography>
              <Typography variant="h4" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                {totalEarnings} ₡
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            '&:hover': { borderColor: '#ffd700' }
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#ffd700', fontSize: '0.9rem' }}>
                Total Sales
              </Typography>
              <Typography variant="h4" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                {totalSales}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            '&:hover': { borderColor: '#ffd700' }
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#ffd700', fontSize: '0.9rem' }}>
                Platform Fees
              </Typography>
              <Typography variant="h4" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                {totalFees} ₡
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Controls Section */}
      <Paper sx={{ 
        p: 2, 
        mb: 3, 
        backgroundColor: '#1a1a1a',
        border: '1px solid #333'
      }}>
        <Grid container spacing={2} alignItems="center">
          {/* Left side: Search and Sort */}
          <Grid item xs={12} md={8}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' }, 
              gap: 2 
            }}>
              <TextField
                label="Search transactions"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#ffd700' },
                    '&.Mui-focused fieldset': { borderColor: '#ffd700' }
                  },
                  '& .MuiInputLabel-root': { color: '#b0b0b0' },
                  '& .MuiInputBase-input': { color: '#e0e0e0' }
                }}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: '#ffd700', mr: 1 }} />,
                }}
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: '#b0b0b0' }}>Sort by</InputLabel>
                <Select
                  value={sortField}
                  label="Sort by"
                  onChange={(e) => setSortField(e.target.value)}
                  sx={{
                    backgroundColor: '#2a2a2a',
                    color: '#e0e0e0',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' }
                  }}
                >
                  <MenuItem value="created_at">Date</MenuItem>
                  <MenuItem value="credits">Earnings</MenuItem>
                  {/* <MenuItem value="transaction_type">Type</MenuItem> */}
                  <MenuItem value="status">Status</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel sx={{ color: '#b0b0b0' }}>Order</InputLabel>
                <Select
                  value={sortOrder}
                  label="Order"
                  onChange={(e) => setSortOrder(e.target.value)}
                  sx={{
                    backgroundColor: '#2a2a2a',
                    color: '#e0e0e0',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffd700' }
                  }}
                >
                  <MenuItem value="desc">Newest</MenuItem>
                  <MenuItem value="asc">Oldest</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>

          {/* Right side: Refresh and Export buttons */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'center', md: 'flex-end' } }}>
              <Button
                startIcon={<RefreshIcon />}
                onClick={refreshTransactions}
                variant="outlined"
                disabled={loading}
                sx={{
                  borderColor: '#4caf50',
                  color: '#4caf50',
                  '&:hover': {
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)'
                  },
                  '&:disabled': {
                    borderColor: '#666',
                    color: '#666'
                  }
                }}
              >
                Refresh
              </Button>
              <Button
                startIcon={<DownloadIcon />}
                onClick={exportToCSV}
                variant="outlined"
                sx={{
                  borderColor: '#ffd700',
                  color: '#ffd700',
                  '&:hover': {
                    borderColor: '#ffd700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)'
                  }
                }}
              >
                Export CSV
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Transactions Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          backgroundColor: '#2a2a2a',
          border: '1px solid #444',
          maxHeight: '600px',
          overflow: 'auto'
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ 
                backgroundColor: '#1a1a1a', 
                color: '#ffd700', 
                fontWeight: 'bold',
                borderBottom: '2px solid #ffd700'
              }}>
                Earnings
              </TableCell>
              <TableCell sx={{ 
                backgroundColor: '#1a1a1a', 
                color: '#ffd700', 
                fontWeight: 'bold',
                borderBottom: '2px solid #ffd700'
              }}>
                Item/Buyer
              </TableCell>
              <TableCell sx={{ 
                backgroundColor: '#1a1a1a', 
                color: '#ffd700', 
                fontWeight: 'bold',
                borderBottom: '2px solid #ffd700'
              }}>
                Type
              </TableCell>
              <TableCell sx={{ 
                backgroundColor: '#1a1a1a', 
                color: '#ffd700', 
                fontWeight: 'bold',
                borderBottom: '2px solid #ffd700'
              }}>
                Date
              </TableCell>
              <TableCell sx={{ 
                backgroundColor: '#1a1a1a', 
                color: '#ffd700', 
                fontWeight: 'bold',
                borderBottom: '2px solid #ffd700'
              }}>
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: '#e0e0e0', py: 4 }}>
                  <CircularProgress sx={{ color: '#ffd700' }} />
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: '#f44336', py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body1" color="error">
                      {error}
                    </Typography>
                    <Button 
                      onClick={refreshTransactions}
                      variant="outlined"
                      size="small"
                      disabled={loading}
                      sx={{
                        borderColor: '#f44336',
                        color: '#f44336',
                        '&:hover': {
                          borderColor: '#f44336',
                          backgroundColor: 'rgba(244, 67, 54, 0.1)'
                        }
                      }}
                    >
                      Retry
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {!loading && transactionsToDisplay.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ 
                  color: '#b0b0b0', 
                  py: 4,
                  fontStyle: 'italic'
                }}>
                  No transactions found. Your sales will appear here.
                </TableCell>
              </TableRow>
            )}
            {transactionsToDisplay.map((t) => (
              <TableRow
                key={t.id}
                hover
                onClick={() => handleRowClick(t)}
                sx={{
                  cursor: 'pointer',
                  '&:last-child td, &:last-child th': { border: 0 },
                  '&:hover': {
                    backgroundColor: '#333',
                  },
                  backgroundColor: '#2a2a2a'
                }}
              >
                <TableCell
                  component="th"
                  scope="row"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    color: t.credits >= 0 ? '#2e7d32' : '#f44336'
                  }}
                >
                  {t.credits >= 0 ? '+' : ''}{t.credits || 0} ₡
                </TableCell>
                
                <TableCell sx={{ color: '#e0e0e0' }}>
                  <Box>
                    {/* Desktop view */}
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                      {t.key_title && (
                        <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#ffd700' }}>
                          {t.key_title}
                        </Typography>
                      )}
                      {t.buyer_username && (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#b0b0b0' }}>
                          to {t.buyer_username}
                        </Typography>
                      )}
                      {t.payout_method && (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#b0b0b0' }}>
                          via {t.payout_method}
                        </Typography>
                      )}
                    </Box>

                    {/* Mobile view */}
                    <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '0.65rem',
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#ffd700'
                        }}
                      >
                        {t.key_title || t.payout_method || 'Transaction'}
                      </Typography>
                      {t.buyer_username && (
                        <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                          {t.buyer_username}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Chip
                    label={t.transaction_type}
                    size="small"
                    sx={{
                      fontSize: { xs: '0.6rem', sm: '0.75rem' },
                      height: { xs: 20, sm: 24 },
                      backgroundColor: t.transaction_type === 'Key Sale' ? '#2e7d32' : 
                                       t.transaction_type === 'Earnings Payout' ? '#ffd700' : 
                                       t.transaction_type === 'Platform Fee' ? '#ff9800' : '#f44336',
                      color: t.transaction_type === 'Earnings Payout' ? '#000' : '#fff',
                      fontWeight: 600,
                      '& .MuiChip-label': {
                        px: { xs: 0.5, sm: 1 }
                      }
                    }}
                  />
                </TableCell>
                
                <TableCell sx={{ color: '#e0e0e0' }}>
                  <Box>
                    {/* Desktop view */}
                    <Typography
                      variant="body2"
                      sx={{
                        display: { xs: 'none', sm: 'block' },
                        fontSize: '0.75rem'
                      }}
                    >
                      {new Date(t.created_at).toLocaleDateString()}
                    </Typography>

                    {/* Mobile view */}
                    <Typography
                      variant="body2"
                      sx={{
                        display: { xs: 'block', sm: 'none' },
                        fontSize: '0.65rem',
                        lineHeight: 1.2
                      }}
                    >
                      {new Date(t.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Typography>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Chip
                    label={t.status}
                    size="small"
                    sx={{
                      fontSize: { xs: '0.6rem', sm: '0.75rem' },
                      height: { xs: 18, sm: 22 },
                      backgroundColor: t.status === 'Completed' ? '#2e7d32' : 
                                       t.status === 'Processing' ? '#ff9800' : '#f44336',
                      color: '#fff',
                      fontWeight: 600
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Transaction Details Modal */}
      <Dialog
        open={Boolean(selectedTransaction)}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            color: '#e0e0e0',
            border: '1px solid #333'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid #333', 
          color: '#ffd700',
          fontWeight: 'bold'
        }}>
          Transaction Details
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedTransaction && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                  Transaction Type
                </Typography>
                <Chip
                  label={selectedTransaction.transaction_type}
                  sx={{
                    backgroundColor: selectedTransaction.transaction_type === 'Key Sale' ? '#2e7d32' : 
                                     selectedTransaction.transaction_type === 'Earnings Payout' ? '#ffd700' : 
                                     selectedTransaction.transaction_type === 'Platform Fee' ? '#ff9800' : '#f44336',
                    color: selectedTransaction.transaction_type === 'Earnings Payout' ? '#000' : '#fff',
                    fontWeight: 600
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                  Amount
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: selectedTransaction.credits >= 0 ? '#2e7d32' : '#f44336',
                    fontWeight: 'bold'
                  }}
                >
                  {selectedTransaction.credits >= 0 ? '+' : ''}{selectedTransaction.credits} ₡
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                  Status
                </Typography>
                <Chip
                  label={selectedTransaction.status}
                  sx={{
                    backgroundColor: selectedTransaction.status === 'Completed' ? '#2e7d32' : 
                                     selectedTransaction.status === 'Processing' ? '#ff9800' : '#f44336',
                    color: '#fff'
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                  Date
                </Typography>
                <Typography sx={{ color: '#e0e0e0' }}>
                  {new Date(selectedTransaction.created_at).toLocaleDateString()}
                </Typography>
              </Grid>

              {selectedTransaction.key_title && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                    Item Sold
                  </Typography>
                  <Typography sx={{ color: '#ffd700', fontWeight: 'bold' }}>
                    {selectedTransaction.key_title}
                  </Typography>
                </Grid>
              )}

              {selectedTransaction.buyer_username && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                    Buyer
                  </Typography>
                  <Typography sx={{ color: '#e0e0e0' }}>
                    {selectedTransaction.buyer_username}
                  </Typography>
                </Grid>
              )}

              {selectedTransaction.payout_method && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                    Payout Method
                  </Typography>
                  <Typography sx={{ color: '#e0e0e0' }}>
                    {selectedTransaction.payout_method}
                  </Typography>
                </Grid>
              )}

              {selectedTransaction.commission_rate && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                    Commission Rate
                  </Typography>
                  <Typography sx={{ color: '#e0e0e0' }}>
                    {selectedTransaction.commission_rate}
                  </Typography>
                </Grid>
              )}

              {selectedTransaction.amount_usd && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                    USD Equivalent
                  </Typography>
                  <Typography sx={{ color: '#e0e0e0' }}>
                    ${selectedTransaction.amount_usd/1000}
                  </Typography>
                </Grid>
              )}

              {selectedTransaction.message && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 0.5 }}>
                    Details
                  </Typography>
                  <Typography sx={{ color: '#e0e0e0' }}>
                    {selectedTransaction.message}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #333', pt: 2 }}>
          <Button 
            onClick={handleCloseModal}
            sx={{ 
              color: '#ffd700',
              '&:hover': { backgroundColor: 'rgba(255, 215, 0, 0.1)' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SellerTransactions;
