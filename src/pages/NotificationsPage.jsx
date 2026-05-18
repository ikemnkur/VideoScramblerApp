import React from 'react';
import { Box, Typography } from '@mui/material';
import Notifications from '../components/Notifications.jsx';

export default function NotificationsPage() {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, md: 4 }, py: 5 }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 800, mb: 4, color: 'text.primary' }}
      >
        Notifications
      </Typography>
      <Notifications />
    </Box>
  );
}
