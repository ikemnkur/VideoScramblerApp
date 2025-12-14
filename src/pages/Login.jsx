import React, { useState } from 'react';
import { Container, Card, CardContent, Stack, TextField, Typography, Button } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import SimpleDotCaptcha from '../components/SimpleDotCaptcha';


export default function Login() {
    const [email, setEmail] = useState('test@example.com');
    const [password, setPassword] = useState('password');
    const [captchaOK, setCaptchaOK] = useState(false);
    const { login } = useAuth();
    const { error, success } = useToast();
    const nav = useNavigate();


    const submit = async () => {
        if (!captchaOK) return error('Please complete CAPTCHA');
        const ok = await login(email, password);
        if (ok) { success('Welcome back!'); nav('/'); } else { error('Invalid credentials'); }
    };


    const [isMobile, setIsMobile] = useState(false);

    return (
        <Container sx={{ py: 4 }}>
            <Card variant="elevated">
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h5">Login!</Typography>

                        <Stack direction="row" spacing={2} alignItems="center">
                            <Typography variant="body2">Desktop Mode</Typography>
                            <Button 
                                variant={isMobile ? "outlined" : "contained"} 
                                size="small"
                                onClick={() => setIsMobile(false)}
                            >
                                PC
                            </Button>
                            <Button 
                                variant={isMobile ? "contained" : "outlined"} 
                                size="small"
                                onClick={() => setIsMobile(true)}
                            >
                                Mobile
                            </Button>
                        </Stack>

                        <TextField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                        <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                        
                        {isMobile ? (
                            <DotCaptcha onsuccess={() => setCaptchaOK(true)} onFail={() => setCaptchaOK(false)} />
                        ) : (
                            <SimpleDotCaptcha maxDots={10} onPass={() => setCaptchaOK(true)} onFail={() => setCaptchaOK(false)} />
                        )}
                        
                        <Button variant="contained" color="secondary" onClick={submit}>Login</Button>
                        <Typography variant="body2">No account? <Button component={RouterLink} to="/register" size="small">Register</Button></Typography>
                    </Stack>
                </CardContent>
            </Card>
        </Container>
    );
}