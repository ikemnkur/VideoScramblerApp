import React, { useState } from 'react';
import { Button } from '@mui/material';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';


// This calls your backend to create a checkout and then redirects the browser.
export default function PaymentButton({ amountUSD = 5, children, onError }) {
    const [loading, setLoading] = useState(false);
    const { info, error } = useToast();


    const click = async () => {
        try {
            setLoading(true);
            info('Opening crypto checkout…');
            const { data } = await api.post('/payments/create-checkout', { amountUSD });
            if (data?.hosted_url) {
                window.location.href = data.hosted_url;
            } else {
                error('Could not start checkout');
                onError && onError();
            }
        } catch (e) {
            console.error(e);
            error('Payment init failed');
            onError && onError();
        } finally { setLoading(false); }
    };
    return (
        <Button onClick={click} disabled={loading} variant="contained" color="secondary">
            {children || (loading ? 'Starting…' : 'Add Credits')}
        </Button>
    );
}


// ```jsx
// import React, { useState } from 'react';
// import { Button } from '@mui/material';
// import api from '../api/client';


// // This calls your backend to create a checkout and then redirects the browser.
// export default function PaymentButton({ amountUSD = 5, children }){
// const [loading, setLoading] = useState(false);
// const click = async () => {
// try{
// setLoading(true);
// const { data } = await api.post('/payments/create-checkout', { amountUSD });
// if (data?.hosted_url) {
// window.location.href = data.hosted_url;
// } else {
// alert('Could not start checkout');
// }
// }catch(e){
// console.error(e);
// alert('Payment init failed');
// }finally{ setLoading(false); }
// };
// return (
// <Button onClick={click} disabled={loading} variant="contained" color="secondary">
// {children || (loading? 'Starting…':'Add Credits')}
// </Button>
// );
// }