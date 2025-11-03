// import React, { useState } from 'react';
// import axios from '../api/client';

// export default function CreateKey() {
//   const [file, setFile] = useState(null);
//   const [title, setTitle] = useState('');
//   const [price, setPrice] = useState(50);

//   const submit = async () => {
//     const fd = new FormData();
//     fd.append('file', file);
//     fd.append('title', title);
//     fd.append('price_credits', price);
//     const res = await axios.post('/host/upload', fd);
//     alert('uploaded: ' + res.data.uploadId);
//   };

//   return (
//     <div>
//       <h2>Upload Keys (one-per-line)</h2>
//       <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" />
//       <input type="number" value={price} onChange={e=>setPrice(e.target.value)} />
//       <input type="file" accept=".txt,.csv" onChange={e=>setFile(e.target.files[0])}/>
//       <button onClick={submit}>Upload</button>
//     </div>
//   );
// }


import React, { useState } from 'react';
import { 
  Container, 
  Stack, 
  Typography, 
  TextField, 
  Card, 
  CardContent, 
  Button, 
  Box,
  Divider,
  Alert,
  Chip,
  Paper
} from '@mui/material';
import { Upload, AttachFile, Description } from '@mui/icons-material';
import api from '../api/client';

import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

export default function CreateKey(){
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(50);
  const [file, setFile] = useState(null);
  const [keyText, setKeyText] = useState('');
  const [uploadMethod, setUploadMethod] = useState('file'); // 'file' or 'text'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', or null
  const [errorMessage, setErrorMessage] = useState('');
  // const userData = JSON.parse(localStorage.getItem('userdata') || '{}');
   const userData = JSON.parse(localStorage.getItem("userdata") || '{"username":"user_123"}');
  const [keysAvailable, setKeysAvailable] = useState(10);
  const [expirationDays, setExpirationDays] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const navigate = useNavigate();
  
  // Function to validate and count keys
  const validateKeys = (content) => {
    if (!content || !content.trim()) return { valid: false, count: 0, errors: [] };
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const errors = [];
    const validKeys = [];
    
    lines.forEach((line, index) => {
      // Basic validation - keys should be at least 4 characters and not contain spaces
      if (line.length < 4) {
        errors.push(`Line ${index + 1}: Key too short (minimum 4 characters)`);
      // } else if (line.includes(' ')) {
      //   errors.push(`Line ${index + 1}: Key contains spaces`);
      } else {
        validKeys.push(line);
      }
    });
    
    return {
      valid: errors.length === 0 && validKeys.length > 0,
      count: validKeys.length,
      errors: errors,
      keys: validKeys
    };
  };
  
  const submit = async () => {
    if (!file && !keyText.trim()) {
      setUploadStatus('error');
      setErrorMessage('Please provide keys via file upload or text input.');
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    setErrorMessage('');

    // Prepare and validate key content
    let fileContent = '';
    if (uploadMethod === 'text' && keyText.trim()) {
      fileContent = keyText.trim();
    } else if (file) {
      // Read file as text
      try {
        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } catch (err) {
        setIsUploading(false);
        setUploadStatus('error');
        setErrorMessage('Failed to read file.');
        return;
      }
    }

    // Validate keys
    const validation = validateKeys(fileContent);
    if (!validation.valid) {
      setIsUploading(false);
      setUploadStatus('error');
      setErrorMessage(`Key validation failed:\n${validation.errors.join('\n')}`);
      return;
    }

    // // Check if keys_available matches actual key count
    // if (keysAvailable !== validation.count) {
    //   const shouldContinue = window.confirm(
    //     `You specified ${keysAvailable} keys available, but uploaded ${validation.count} keys. ` +
    //     `Do you want to continue with ${validation.count} keys?`
    //   );
    //   if (shouldContinue) {
    //     setKeysAvailable(validation.count);
    //   } else {
    //     setIsUploading(false);
    //     return;
    //   }
    // }

    // Compose request body as JSON (not FormData)
    const payload = {
      title,
      price_credits: price,
      email: userData?.email || '',
      username: userData?.username || 'demo_seller',
      file: fileContent,
      // Optionally add more fields if your server expects them
      keys_available: keysAvailable,
      description,
      expiration_days: expirationDays || undefined,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      encryptionKey: userData?.encryptionKey || '',
      profilepic: userData?.profilePicture || ''
    };

    try {
      const { data } = await api.post('/api/create-key', payload);
      if (data && data.success) {
        setUploadStatus('success');
        // Update success message to include number of keys processed
        const successMsg = data.keysProcessed ? 
          `Successfully uploaded ${data.keysProcessed} keys!` : 
          'Keys uploaded successfully!';
        setErrorMessage(successMsg); // Use error message state for success message too
        
        // Reset form
        setTitle('');
        setPrice(50);
        setFile(null);
        setKeyText('');
        setDescription('');
        setExpirationDays('');
        setKeysAvailable(10);
        setTags('');

        setTimeout(() => {
          navigate('/listings')
        }, 2000); // Clear message after 10 seconds
      } else {
        setUploadStatus('error');
        setErrorMessage(data?.message || 'Upload failed.');
      }
    } catch (e) {
      console.error(e);
      setUploadStatus('error');
      setErrorMessage(e.response?.data?.message || 'Server error. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  

//   // Server route for /api/create-key
// 
// server.post('/api/create-key', async (req, res) => {
//   try {
//     const { title, price_credits, email, username, file, desrciption, tags, encryptionKey } = req.body;

//     console.log('Creating key with data:', { title, price_credits, email, username, file, desrciption, tags, encryptionKey });
//     // Simulate file processing
//     setTimeout(async () => {
//       try {
//         const keyId = `key_${Date.now()}`;
//         const quantity = Math.floor(Math.random() * 50) + 10;
//         // Generate a unique id for the primary key
//         const id = Math.random().toString(36).substring(2, 12).toUpperCase();

//         await pool.execute(
//           'INSERT INTO createdKeys (id, keyId, username, email, keyTitle, keyValue, description, price, quantity, sold, available, creationDate, expirationDate, isActive, isReported, reportCount, encryptionKey, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
//           [
//             id,
//             keyId,
//             username || 'demo_seller',
//             email || 'jane.seller@example.com',
//             title || 'New Key Listing',
//             file,
//             desrciption || 'No description provided.',
//             parseInt(price_credits) || 100,
//             quantity,
//             0,
//             quantity,
//             Date.now(),
//             null,
//             true,
//             false,
//             0,
//             encryptionKey || `enc_key_${Date.now()}`,
//             tags || JSON.stringify(['demo', 'uploaded'])
//           ]
//         );

//         res.json({
//           success: true,
//           uploadId: keyId,
//           message: 'Keys uploaded successfully'
//         });
//       } catch (error) {
//         console.error('Create key error:', error);
//         res.status(500).json({ success: false, message: 'Database error' });
//       }
//     }, 1000);
//   } catch (error) {
//     console.error('Create key outer error:', error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

  return (
    <Container sx={{ py: 4, maxWidth: 'md' }}>
      <Stack spacing={4}>
        <Box textAlign="center">
          <Typography variant="h3" color="primary.main" gutterBottom sx={{ fontWeight: 700 }}>
            Create a Key Listing
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Upload your keys and set a price for others to purchase
          </Typography>
        </Box>

        {/* Status Messages */}
        {uploadStatus === 'success' && (
          <Alert severity="success" onClose={() => setUploadStatus(null)}>
            {uploadStatus === 'success' && errorMessage.includes('Successfully') ? 
              errorMessage + ' Your listing is now live.' : 
              'Keys uploaded successfully! Your listing is now live.'
            }
          </Alert>
        )}
        {uploadStatus === 'error' && (
          <Alert severity="error" onClose={() => setUploadStatus(null)}>
            {errorMessage || 'Upload failed. Please check your file and try again.'}
          </Alert>
        )}

        <Card variant="outlined" sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3}>
              {/* Basic Information */}
              <Box>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Description color="primary" />
                  Listing Details
                </Typography>
                <Stack spacing={2}>
                  <TextField 
                    label="Listing Title" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    fullWidth
                    required
                    placeholder="e.g., Premium Gaming Keys Bundle"
                    helperText="Give your key listing a descriptive title"
                  />
                 <Box sx={{ display: 'flex', gap: 2 }}> 
                   <TextField 
                    type="number" 
                    label="Price per Key (credits)" 
                    value={price} 
                    onChange={e => setPrice(Number(e.target.value))}
                    fullWidth
                    required
                    inputProps={{ min: 1, max: 10000 }}
                    helperText="Set the price in credits for each key"
                  />
                  <TextField 
                    type="number" 
                    label="Keys available" 
                    value={keysAvailable} 
                    onChange={e => setKeysAvailable(Number(e.target.value))}
                    fullWidth
                    required
                    inputProps={{ min: 1, max: 10000 }}
                    helperText="Set the number of keys available for purchase"
                  />
                 </Box>
                  {/* expiration date picker */}
                  <TextField 
                    type="number" 
                    label="Expiration Days (optional)" 
                    value={expirationDays} 
                    onChange={e => setExpirationDays(Number(e.target.value))}
                    fullWidth
                    inputProps={{ min: 1, max: 365 }}
                    helperText="Set how many days before the listing expires (leave blank for no expiration)"
                  />
                  {/* description */}
                  <TextField
                    label="Description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    multiline
                    rows={4}
                    fullWidth
                    placeholder="Provide a detailed description of your key listing"
                    helperText="Add any additional information or terms"
                  />
                  {/* tags */}
                  {/* <TextField
                    label="Tags (comma separated)"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    fullWidth
                    placeholder="e.g., gaming, premium, bundle"
                    helperText="Add relevant tags to help users find your listing"
                  /> */}
                </Stack>

              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Upload Method Selection */}
              <Box>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Upload color="primary" />
                  Upload Keys
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose how you'd like to provide your keys (one key per line)
                </Typography>

                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                  <Chip
                    label="Upload File"
                    variant={uploadMethod === 'file' ? 'filled' : 'outlined'}
                    color={uploadMethod === 'file' ? 'primary' : 'default'}
                    onClick={() => setUploadMethod('file')}
                    clickable
                  />
                  <Chip
                    label="Paste/Type Keys"
                    variant={uploadMethod === 'text' ? 'filled' : 'outlined'}
                    color={uploadMethod === 'text' ? 'primary' : 'default'}
                    onClick={() => setUploadMethod('text')}
                    clickable
                  />
                </Stack>

                {/* File Upload Method */}
                {uploadMethod === 'file' && (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.900', border: '1px solid', borderColor: 'primary.main' }}>
                    <Button 
                      variant="outlined" 
                      component="label" 
                      color="primary"
                      size="large"
                      startIcon={<AttachFile />}
                      sx={{ mb: 2 }}
                    >
                      Choose File (.txt or .csv)
                      <input 
                        type="file" 
                        hidden 
                        accept=".txt,.csv" 
                        onChange={e => setFile(e.target.files?.[0] || null)} 
                      />
                    </Button>
                    {file && (
                      <Typography variant="body2" color="text.primary" sx={{ color: 'white' }}>
                        Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                      </Typography>
                    )}
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'grey.300' }}>
                      Supported formats: .txt, .csv (one key per line)
                    </Typography>
                  </Paper>
                )}

                {/* Text Input Method */}
                {uploadMethod === 'text' && (
                  <TextField
                    multiline
                    rows={8}
                    fullWidth
                    variant="outlined"
                    placeholder="Paste or type your keys here, one per line:&#10;KEY1-ABCD-EFGH&#10;KEY2-IJKL-MNOP&#10;KEY3-QRST-UVWX"
                    value={keyText}
                    onChange={e => setKeyText(e.target.value)}
                    sx={{ 
                      '& .MuiInputBase-input': { 
                        fontFamily: 'monospace',
                        fontSize: '0.9rem'
                      }
                    }}
                    // helperText={(() => {
                    //   const validation = validateKeys(keyText);
                    //   const baseText = `${validation.count} valid keys entered`;
                    //   if (validation.errors.length > 0) {
                    //     return `${baseText} (${validation.errors.length} errors found)`;
                    //   }
                    //   return baseText;
                    // })()}
                  />
                )}
              </Box>

              {/* Submit Button */}
              <Box textAlign="center" sx={{ pt: 2 }}>
                <Button 
                  onClick={submit} 
                  variant="contained" 
                  color="primary"
                  size="large"
                  disabled={isUploading || (!file && !keyText.trim()) || !title.trim()}
                  sx={{ 
                    px: 4, 
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600
                  }}
                >
                  {isUploading ? 'Uploading...' : 'Create Listing'}
                </Button>
                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                  Your keys will be available for purchase once uploaded
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}