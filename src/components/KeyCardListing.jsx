import React, { useState } from 'react';
// impoirt useState React from 'react';
import { Card, CardContent, CardActions, Typography, Button, Chip, Stack } from '@mui/material';

export default function KeyCard({ item, onUnlock }){
  console.log("Key Card:", item);
  const available = item.available ?? Math.max(0, (item.quantity ?? 0) - (item.sold ?? 0));
  const [revealed, setRevealed] = useState(false);

  function handleRevealKey() {
    setRevealed(true);
  }

  return (
    <Card variant={item.dark ? 'outlined' : 'elevated'} sx={{minWidth:280, borderRadius: 6, border: '5px solid rgba(76, 218, 0, 0.68)'}}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" sx={{fontWeight:800}}>{item.keyTitle}</Typography>
          <Chip size="small" label={`${available} left`} color={available>0? 'secondary':'default'} />
        </Stack>
        {/* limit to 40 characters */}
        <Typography variant="body2" sx={{opacity:0.85, mb:1}}>{String(item.description).slice(0, 40)}{String(item.description).length > 40 ? "..." : ""}</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip label={`${item.price} credits`} color="primary" />
          {/* <Chip label="85% to host" variant="outlined" /> */}
        </Stack>
      </CardContent>
      <CardActions>
        <Button fullWidth onClick={handleRevealKey} disabled={available===0} variant="contained" color="secondary">{revealed ? item.keyValue : "Reveal Key"}</Button>
      </CardActions>
    </Card>
  );
}