import { useState } from 'react'
import React from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import YourKeys from './pages/YourKeys';
import Wallet from './pages/Wallet';
import CreateKey from './pages/CreateKey';
import Unlock from './pages/Unlock';
import Earnings from './pages/Earnings';
import Auth from './components/Auth';
import HelpPage from './pages/HelpPage';
import Main from './pages/Main';
import PurchaseHistory from './pages/PurchaseHistory';
import Redeem from './pages/Redeem';
import ProtectedRoute from './components/ProtectedRoute';
import Account from './pages/Account';
// import { fetchUserProfile } from './api/client';
import { useNavigate } from 'react-router-dom';
// import YourKeys from './pages/YourKeys';
import Listings from './pages/Listing';
import Purchase from './pages/PurchaseCrypto';
import Info from './pages/Info';
import SignUp2Unlock from './pages/SignUp2Unlock';
import UnlockPreview from './pages/UnlockPreview';
import LoadingPage from './pages/Loading';
import Scrambler from './pages/Scrambler';
import Unscrambler from './pages/Unscrambler';
import Plans from './pages/Plans';

// import CheckoutForm from './components/CheckoutForm';
import { StripeCheckoutForm, Return } from "./components/Stripe";


import Subscribe from './pages/Subscribe';
import SubscribeConfirmation from './pages/SubscribeConfirmation';
import PurchaseCrypto from './pages/PurchaseCrypto';
import PurchaseStripe from './pages/PurchaseStripe';

import { loadStripe } from '@stripe/stripe-js';

import './styles.css';
import { ToastProvider } from './contexts/ToastContext';

export default function App() {


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <BrowserRouter>
          <NavBar />
          <Routes>
            {/* Public Routes */}
            {!(localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')).loginStatus : false) && (
              <>
                <Route path="/login" element={<Auth isLogin={true} />} />
                <Route path="/register" element={<Auth isLogin={false} />} />
              </>
            )}

            {/* {!(localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')).loginStatus : false) && (
              <Route path="/unlock/:id" element={<SignUp2Unlock />} />
            )} */}
            <Route path="/help" element={<HelpPage />} />
            <Route path="/info" element={<Info />} />
            <Route path="/login" element={<Auth isLogin={true} />} />

            {/* Seller/ Buyer Routes */}
            {/* {(localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')).accountType : null) === 'buyer' && ( */}
            <>
              {/* <Route path="/unlock/:id" element={<Unlock />} /> */}
              {/* <Route path="/wallet" element={<Wallet />} /> */}
              <Route path="/purchase-crypto" element={<PurchaseCrypto />} />
              <Route path="/purchase-stripe" element={<PurchaseStripe />} />
              {/* <Route path="/your-keys" element={<YourKeys />} /> */}
              <Route path="/purchase-history" element={<PurchaseHistory />} />
              <Route path="/account" element={<Account />} />
            </>
            {/* )} */}
            {/* {(localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')).accountType : null) === 'seller' && ( */}
            {/* <>
                 <Route path="/unlock-preview/:id" element={<UnlockPreview />} />
                <Route path="/earnings" element={<Earnings />} />
                <Route path="/create-key" element={<CreateKey />} />
                <Route path="/redeem" element={<Redeem />} />
                <Route path="/listings" element={<Listings />} />
                <Route path="/account" element={<Account />} />
              </> */}
            {/* )} */}

            {/* Main Route */}
            {/* not logged in */}
            {!(localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')).loginStatus : false) && (
              <>
                <Route path="/" element={<Info />} />
              </>
            )}
            {/* logged in */}
            {(localStorage.getItem('userdata') ? JSON.parse(localStorage.getItem('userdata')).loginStatus : false) && (
              <Route path="/" element={<Main />} />
            )}
            <Route path="/main" element={<Main />} />

            <Route path="/wallet" element={<Wallet />} />

            <Route path="/plans" element={<Plans />} />

            <Route path="/subscribe" element={<Subscribe />} />
            <Route path="/subscribe-confirmation" element={<SubscribeConfirmation />} />

            <Route path="/stripe-checkout" element={
              <ProtectedRoute> <StripeCheckoutForm setCoins={5000} /> </ProtectedRoute>} />

            {/* <Route path="/intro" element={<Intro />} /> */}


            <Route path="/scrambler" element={<Scrambler />} />

            <Route path="/unscrambler" element={<Unscrambler />} />


            {/* need a redirect or fallback route if not logged in and the user tries to visit a protected route */}
            <Route path="*" element={<LoadingPage />} />


          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
