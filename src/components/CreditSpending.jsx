import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  Chip,
  CircularProgress,
  Modal,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Key,
  RemoveCircle,
} from "@mui/icons-material";
import axios from "axios";

// Helper component for the modal
const DetailsModal = ({ transaction, open, handleClose }) => {
  if (!transaction) return null;

  const getTransactionIcon = (type) => {
    if (type === "Key Purchase") return <Key sx={{ color: "#ffd700", mr: 1 }} />;
    return <RemoveCircle sx={{ color: "#f44336", mr: 1 }} />;
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        sx={{
          p: 4,
          width: { xs: "90%", md: "550px" },
          maxHeight: "80vh",
          overflowY: "auto",
          position: "relative",
          backgroundColor: "#1a1a1a",
          border: "2px solid #ffd700",
          borderRadius: 2,
        }}
      >
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: "#ffd700",
            "&:hover": { backgroundColor: "#333" },
          }}
        >
          <CloseIcon />
        </IconButton>

        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          {getTransactionIcon(transaction.transaction_type)}
          <Typography variant="h5" sx={{ color: "#ffd700", fontWeight: 600 }}>
            Transaction Details
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ color: "#b0b0b0" }}>Transaction ID:</Typography>
            <Typography sx={{ color: "#e0e0e0", fontFamily: "monospace" }}>
              #{transaction.id}
            </Typography>
          </Box>

          {transaction.title && (
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ color: "#b0b0b0" }}>Action:</Typography>
              <Typography sx={{ color: "#ffd700", fontWeight: 600 }}>
                {transaction.title}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ color: "#b0b0b0" }}>Credits Spent:</Typography>
            <Typography
              sx={{
                color: "#f44336",
                fontWeight: 700,
                fontSize: "1.1rem",
              }}
            >
              -{transaction.credits} credits
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ color: "#b0b0b0" }}>Type:</Typography>
            <Chip
              label={transaction.transaction_type}
              size="small"
              sx={{
                backgroundColor:
                  transaction.transaction_type === "Key Purchase"
                    ? "#ffd700"
                    : "#f44336",
                color: "#000",
                fontWeight: 600,
              }}
            />
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ color: "#b0b0b0" }}>Date:</Typography>
            <Typography sx={{ color: "#e0e0e0" }}>
              {new Date(transaction.created_at).toLocaleString()}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ color: "#b0b0b0" }}>Status:</Typography>
            <Chip
              label={transaction.status}
              size="small"
              sx={{
                backgroundColor:
                  transaction.status === "Completed"
                    ? "#2e7d32"
                    : transaction.status === "Processing"
                    ? "#ff9800"
                    : "#f44336",
                color: "#fff",
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ color: "#b0b0b0", mb: 1 }}>Details:</Typography>
            <Box
              sx={{
                p: 2,
                backgroundColor: "#2a2a2a",
                border: "1px solid #555",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ color: "#e0e0e0" }}>
                {transaction.message || "No details provided."}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Modal>
  );
};

const CreditSpending = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const API_URL = import.meta.env.VITE_API_SERVER_URL || "http://localhost:3001";

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        // Get current user from localStorage
        const userData = JSON.parse(localStorage.getItem("userdata"));
        const username = userData.username;
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No authentication token found. Please login again.");
        }

        // Load cached transaction data
        const cachedDataString = localStorage.getItem("creditSpendingCache");
        let cachedData = [];
        let lastTransactionDate = null;

        if (cachedDataString) {
          try {
            cachedData = JSON.parse(cachedDataString);

            if (cachedData.length > 0) {
              const dates = cachedData.map((item) => {
                const dateValue = item.created_at || item.date;
                return new Date(dateValue).getTime();
              });

              const mostRecentTimestamp = Math.max(...dates);
              lastTransactionDate = new Date(mostRecentTimestamp).toISOString();
              console.log("Last cached spending date:", lastTransactionDate);
            }
          } catch (err) {
            console.error("Failed to parse cached data:", err);
            cachedData = [];
          }
        }

        // Build query params for incremental fetch
        const queryParams = lastTransactionDate
          ? `?since=${encodeURIComponent(lastTransactionDate)}`
          : "";

        console.log(
          lastTransactionDate
            ? "Fetching incremental spending since last transaction"
            : "Fetching all spending (no cache)"
        );

        // Fetch actions (spending)
        const actionsResponse = await axios.get(
          `${API_URL}/api/actions/${username}${queryParams}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const allActions = actionsResponse.data;

        // Filter for current user's transactions
        const userActions = allActions.filter((action) => action.username === username);

        // Merge new data with cached data and remove duplicates
        const allData = [...userActions, ...cachedData];
        const uniqueData = Array.from(
          new Map(allData.map((item) => [item.id, item])).values()
        );

        console.log("Total spending transactions after merge:", uniqueData.length);
        console.log(
          "Cache saved:",
          cachedData.length > 0
            ? `${cachedData.length} cached, ${userActions.length} new`
            : "First load"
        );

        // Store the combined data in cache
        localStorage.setItem("creditSpendingCache", JSON.stringify(uniqueData));

        // Transform actions to transaction format
        const actionsTransactions = uniqueData.map((action) => {
          const transactionType = action.action_description?.includes("pass")
            ? "Pass Purchase"
            : "Scrambling Media Purchase";

          return {
            id: `action_${action.id}`,
            transaction_type: transactionType,
            credits: action.action_cost,
            amount_usd: (action.price * 0.01).toFixed(2),
            title: action.action_type,
            buyer_username: action.username,
            status: "Completed",
            created_at: new Date(action.date).toISOString(),
            message: `${transactionType}: ${action.keyTitle || action.action_type}`,
            payout_method: null,
            commission_rate: null,
          };
        });

        // Sort by date descending
        actionsTransactions.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        setTransactions(actionsTransactions);
        setFilteredTransactions(actionsTransactions);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch spending history:", err);

        if (err.response?.status === 401 || err.response?.status === 403) {
          setError(
            "Your session has expired. Please log out and log back in to continue."
          );
          setTimeout(() => {
            localStorage.removeItem("token");
            localStorage.removeItem("userdata");
            window.location.href = "/login";
          }, 3000);
        } else {
          setError("Failed to load spending history. Please try again later.");
        }
        setLoading(false);
      }
    };
    loadTransactions();
  }, []);

  const searchTransactions = () => {
    const term = searchTerm.toLowerCase();
    const safe = (v) => (v ? String(v).toLowerCase() : "");
    const filtered = transactions.filter(
      (t) =>
        safe(t.title).includes(term) ||
        safe(t.message).includes(term) ||
        safe(t.transaction_type).includes(term) ||
        safe(t.credits).includes(term) ||
        safe(t.status).includes(term)
    );
    setFilteredTransactions(filtered);
  };

  const handleSearch = (e) => {
    e?.preventDefault?.();
    searchTransactions();
  };

  const handleReset = () => {
    setSearchTerm("");
    setFilteredTransactions(transactions);
  };

  const sortTransactions = (rows) => {
    const sorted = [...rows].sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case "date":
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case "amount":
          aValue = parseFloat(a.credits || 0);
          bValue = parseFloat(b.credits || 0);
          break;
        case "status":
          aValue = String(a.status || "").toLowerCase();
          bValue = String(b.status || "").toLowerCase();
          break;
        case "type":
          aValue = String(a.transaction_type || "").toLowerCase();
          bValue = String(b.transaction_type || "").toLowerCase();
          break;
        default:
          aValue = a.id;
          bValue = b.id;
      }
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const transactionsToDisplay = sortTransactions(filteredTransactions);

  const exportToCSV = () => {
    const headers = ["Date", "Action", "Credits Spent", "Type", "Status", "Details"];
    const rows = transactionsToDisplay.map((t) => [
      new Date(t.created_at).toLocaleDateString(),
      t.title || "N/A",
      t.credits || 0,
      t.transaction_type,
      t.status,
      t.message || "",
    ]);

    const csv =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "credit-spending.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRowClick = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailsModal(true);
  };

  // Calculate total credits spent
  const totalCredits = transactions.reduce((sum, t) => sum + (t.credits || 0), 0);

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        backgroundColor: "#0a0a0a",
        minHeight: "100vh",
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            color: "#f44336",
            mb: 1,
          }}
        >
          Credit Spending
        </Typography>
        <Typography variant="h6" sx={{ color: "#e0e0e0" }}>
          Track your credit usage and actions
        </Typography>
        <Typography variant="body1" sx={{ color: "#ffd700", mt: 1 }}>
          Total Credits Spent: {totalCredits} ₡
        </Typography>
      </Box>

      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          backgroundColor: "#1a1a1a",
          border: "2px solid #f44336",
          borderRadius: 2,
        }}
      >
        {/* Controls */}
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: "#f44336" }}>
          Your Spending History
        </Typography>

        <Box
          component="form"
          onSubmit={handleSearch}
          sx={{
            position: "relative",
            mb: 2,
            p: { xs: 0.5, sm: 1 },
          }}
        >
          {/* Search Row */}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              flexWrap: "nowrap",
              width: "100%",
              mb: 1,
            }}
          >
            <TextField
              label="Search transactions"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{
                flexBasis: "85%",
                flexGrow: 1,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#2a2a2a",
                  color: "#e0e0e0",
                  "& fieldset": { borderColor: "#555" },
                  "&:hover fieldset": { borderColor: "#f44336" },
                  "&.Mui-focused fieldset": { borderColor: "#f44336" },
                },
                "& .MuiInputLabel-root": { color: "#b0b0b0" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#f44336" },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#f44336" }} />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              sx={{
                textTransform: "none",
                flexBasis: "15%",
                minWidth: 0,
                px: 2,
                flexShrink: 0,
                whiteSpace: "nowrap",
                backgroundColor: "#f44336",
                "&:hover": { backgroundColor: "#d32f2f" },
              }}
            >
              Search
            </Button>
          </Box>

          {/* Filters and Count Row */}
          <Box
            sx={{
              mt: 1.5,
              display: "flex",
              gap: 1,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <Box
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                flexWrap: "wrap",
                flex: 1,
              }}
            >
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                size="small"
                sx={{
                  minWidth: 100,
                  backgroundColor: "#2a2a2a",
                  color: "#e0e0e0",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#f44336",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#f44336",
                  },
                }}
              >
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="amount">Credits</MenuItem>
                <MenuItem value="type">Type</MenuItem>
                <MenuItem value="status">Status</MenuItem>
              </Select>

              <Select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                size="small"
                sx={{
                  minWidth: 100,
                  backgroundColor: "#2a2a2a",
                  color: "#e0e0e0",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#f44336",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#f44336",
                  },
                }}
              >
                <MenuItem value="asc">Ascending</MenuItem>
                <MenuItem value="desc">Descending</MenuItem>
              </Select>

              <Chip
                label={`${transactionsToDisplay.length} transaction${
                  transactionsToDisplay.length === 1 ? "" : "s"
                }`}
                variant="outlined"
                sx={{
                  marginRight: "1%",
                  borderColor: "#f44336",
                  color: "#f44336",
                  backgroundColor: "#2a2a2a",
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: { xs: 400, md: 500 },
            overflowY: "auto",
            overflowX: "auto",
            borderRadius: 1,
            backgroundColor: "#2a2a2a",
          }}
        >
          <Table
            sx={{
              minWidth: { xs: 320, sm: 500 },
              "& .MuiTableCell-root": {
                px: { xs: 0.5, sm: 2 },
                py: { xs: 1, sm: 1.5 },
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                borderBottom: "1px solid #444",
              },
              "& .MuiTableHead-root .MuiTableCell-root": {
                fontWeight: 600,
                fontSize: { xs: "0.7rem", sm: "0.875rem" },
                px: { xs: 0.5, sm: 2 },
                backgroundColor: "#1a1a1a",
                color: "#f44336",
                borderBottom: "2px solid #f44336",
              },
            }}
            aria-label="credit spending table"
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: { xs: "20%", sm: "auto" }, color: "#f44336" }}>
                  Credits
                </TableCell>
                <TableCell sx={{ width: { xs: "35%", sm: "auto" }, color: "#f44336" }}>
                  Action
                </TableCell>
                <TableCell sx={{ width: { xs: "20%", sm: "auto" }, color: "#f44336" }}>
                  Type
                </TableCell>
                <TableCell sx={{ width: { xs: "15%", sm: "auto" }, color: "#f44336" }}>
                  Date
                </TableCell>
                <TableCell sx={{ width: { xs: "10%", sm: "auto" }, color: "#f44336" }}>
                  Status
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "#e0e0e0", py: 4 }}>
                    <CircularProgress sx={{ color: "#f44336" }} />
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "#f44336", py: 4 }}>
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {!loading && transactionsToDisplay.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    align="center"
                    sx={{
                      color: "#b0b0b0",
                      py: 4,
                      fontStyle: "italic",
                    }}
                  >
                    No spending found. Your actions will appear here.
                  </TableCell>
                </TableRow>
              )}

              {transactionsToDisplay.map((t) => (
                <TableRow
                  key={t.id}
                  hover
                  onClick={() => handleRowClick(t)}
                  sx={{
                    cursor: "pointer",
                    "&:last-child td, &:last-child th": { border: 0 },
                    "&:hover": {
                      backgroundColor: "#333",
                    },
                    backgroundColor: "#2a2a2a",
                  }}
                >
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{
                      fontWeight: 600,
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      color: t.title === "refunded-credits" ? "#56f436" : "#df1717cf",
                    }}
                  >
                    {t.title === "refunded-credits" ? `+${t.credits || 0}` : `-${t.credits || 0}`} ₡
                  </TableCell>

                  <TableCell sx={{ color: "#e0e0e0" }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: "bold",
                        fontSize: { xs: "0.65rem", sm: "0.75rem" },
                        color: "#ffd700",
                      }}
                    >
                      {t.title}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={t.transaction_type}
                      size="small"
                      sx={{
                        fontSize: { xs: "0.6rem", sm: "0.75rem" },
                        height: { xs: 20, sm: 24 },
                        backgroundColor:
                          t.transaction_type === "Key Purchase" ? "#ffd700" : "#f44336",
                        color: "#000",
                        fontWeight: 600,
                        "& .MuiChip-label": {
                          px: { xs: 0.5, sm: 1 },
                        },
                      }}
                    />
                  </TableCell>

                  <TableCell sx={{ color: "#e0e0e0" }}>
                    <Typography
                      variant="body2"
                      sx={{
                        display: { xs: "none", sm: "block" },
                        fontSize: "0.75rem",
                      }}
                    >
                      {new Date(t.created_at).toLocaleDateString()}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        display: { xs: "block", sm: "none" },
                        fontSize: "0.65rem",
                        lineHeight: 1.2,
                      }}
                    >
                      {new Date(t.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={t.status}
                      size="small"
                      sx={{
                        fontSize: { xs: "0.6rem", sm: "0.75rem" },
                        height: { xs: 18, sm: 22 },
                        backgroundColor:
                          t.status === "Completed"
                            ? "#2e7d32"
                            : t.status === "Processing"
                            ? "#ff9800"
                            : "#f44336",
                        color: "#fff",
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box
          sx={{
            display: { xs: "block", sm: "none" },
            mt: 1,
            textAlign: "center",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Tap any row to view details
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            onClick={exportToCSV}
            sx={{
              textTransform: "none",
              flexShrink: 0,
              backgroundColor: "#f44336",
              "&:hover": { backgroundColor: "#d32f2f" },
            }}
          >
            Export CSV
          </Button>
        </Box>
      </Paper>

      {/* Transaction Details Modal */}
      <DetailsModal
        transaction={selectedTransaction}
        open={showDetailsModal}
        handleClose={() => setShowDetailsModal(false)}
      />
    </Box>
  );
};

export default CreditSpending;
