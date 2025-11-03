import React from 'react';
import { Card, CardContent, CardActions, Avatar, Typography, Button, Chip, Stack } from '@mui/material';

export default function KeyCard({ item, onUnlock }){
  console.log("Key Card:", item);
  const available = item.available ?? Math.max(0, (item.quantity ?? 0) - (item.sold ?? 0));
  return (
    <Card variant={item.dark ? 'outlined' : 'elevated'} sx={{minWidth:280, borderRadius: 6, border: '5px solid rgba(76, 218, 0, 0.68)'}}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
           <Avatar
              src={item.profilePic || '/default-avatar.jpg'}
              sx={{ 
                width: 64, 
                height: 64, 
               
                border: '3px solid #ffd700'
              }}
            />
              <Typography variant="h6" sx={{fontWeight:800}}>{item.keyTitle}</Typography>
          <Chip size="small" label={`${available} left`} color={available>0? 'secondary':'default'} />
        
          
        </Stack>
        {/* limit to 40 characters */}
        <Typography variant="body2" sx={{opacity:0.85, mb:1}}><strong>Desc:</strong> {String(item.description).slice(0, 40)}{String(item.description).length > 40 ? "..." : ""}</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip label={`${item.price} credits`} color="primary" />
          {/* <Chip label="85% to host" variant="outlined" /> */}
        </Stack>
      </CardContent>
      <CardActions>
        <Button fullWidth onClick={onUnlock} disabled={available===0} variant="contained" color="secondary">Unlock</Button>
      </CardActions>
    </Card>
  );
}