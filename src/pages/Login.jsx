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


    return (
        <Container sx={{ py: 4 }}>
            <Card variant="elevated">
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h5">Login</Typography>
                        <TextField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                        <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                        <SimpleDotCaptcha maxDots={10} onPass={() => setCaptchaOK(true)} onFail={() => setCaptchaOK(false)} />
                        <Button variant="contained" color="secondary" onClick={submit}>Login</Button>
                        <Typography variant="body2">No account? <Button component={RouterLink} to="/register" size="small">Register</Button></Typography>
                    </Stack>
                </CardContent>
            </Card>
        </Container>
    );
}