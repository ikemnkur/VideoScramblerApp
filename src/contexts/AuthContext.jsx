import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/client';


const Ctx = createContext({ user: null, login: async () => false, register: async () => false, logout: () => { } });


export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);


    useEffect(() => {
        const raw = localStorage.getItem('user');
        if (raw) setUser(JSON.parse(raw));
    }, []);


    const login = async (email, password) => {
        try {
            // json-server doesn't support custom routes natively; emulate with client logic
            const { data: users } = await authApi.get('/users', { params: { email } });
            const u = Array.isArray(users) ? users.find(x => x.email === email) : null;
            if (!u || u.password !== password) throw new Error('bad creds');
            const payload = { token: 'mock', user: { id: u.id, email: u.email, role: u.role || 'client' } };
            localStorage.setItem('token', payload.token);
            localStorage.setItem('user', JSON.stringify(payload.user));
            setUser(payload.user);
            return true;
        } catch { return false; }
    };


    const register = async (email, password) => {
        try {
            const { data: exists } = await authApi.get('/users', { params: { email } });
            if (Array.isArray(exists) && exists.length) throw new Error('exists');
            const { data: created } = await authApi.post('/users', { email, password, role: 'client' });
            const payload = { token: 'mock', user: { id: created.id, email: created.email, role: 'client' } };
            localStorage.setItem('token', payload.token);
            localStorage.setItem('user', JSON.stringify(payload.user));
            setUser(payload.user);
            return true;
        } catch { return false; }
    };


    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };


    return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}


export const useAuth = () => useContext(Ctx);