import { useState } from 'react'
import React from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar';
// import YourKeys from './pages/YourKeys';
import Wallet from './pages/Wallet';
// import CreateKey from './pages/CreateKey';
// import Unlock from './pages/Unlock';
// import Earnings from './pages/Earnings';
import Auth from './components/Auth';
import HelpPage from './pages/HelpPage';
import Main from './pages/Main';
import PurchaseHistory from './pages/PurchaseHistory';
// import Redeem from './pages/Redeem';
import ProtectedRoute from './components/ProtectedRoute';
import Account from './pages/Account';
// import { fetchUserProfile } from './api/client';
import { useNavigate } from 'react-router-dom';
// import YourKeys from './pages/YourKeys';
// import Listings from './pages/Listing';
import Purchase from './pages/PurchaseCrypto';
import PurchaseCrypto from './pages/PurchaseCrypto';
import PurchaseCashApp from './pages/PurchaseCashApp';
import PurchasePaypal from './pages/PurchasePaypal';
import PurchaseStripe from './pages/PurchaseStripe';
import Info from './pages/Info';
// import SignUp2Unlock from './pages/SignUp2Unlock';
// import UnlockPreview from './pages/UnlockPreview';
import LoadingPage from './pages/Loading';

import VideoScrambler from './pages/VideoScrambler';
import VideoScramblerBasic from './pages/VideoScramblerBasic';
import VideoUnscrambler from './pages/VideoUnscrambler';
import VideoUnscramblerBasic from './pages/VideoUnscramblerBasic';

import ScramblerPhotos from './pages/PhotoScrambler';
import UnscramblerPhotos from './pages/PhotoUnscrambler';

import AudioScrambler from './pages/AudioScrambler';
import AudioUnscrambler from './pages/AudioUnscrambler';


import ScramblerPhotosPro from './pages/PhotoScramblerPro';
import UnscramblerPhotosPro from './pages/PhotoUnscramblerPro';

import VideoScramblerPro from './pages/VideoScramblerPro';
import VideoUnscramblerPro from './pages/VideoUnscramblerPro';

import PhotoLeakChecker from './pages/PhotoLeakChecker';
import VideoLeakChecker from './pages/VideoLeakChecker';
import AudioLeakChecker from './pages/AudioLeakChecker';

import Plans from './pages/Plans';

// import CheckoutForm from './components/CheckoutForm';
// import { StripeCheckoutForm, Return } from "./components/Stripe";
import { StripeCheckoutForm, Return } from "./components/Stripe";


import Subscribe from './pages/Subscribe';
import SubscribeConfirmation from './pages/SubscribeConfirmation';
// import PurchaseCrypto from './pages/PurchaseCrypto';
// import PurchaseStripe from './pages/PurchaseStripe';

import SubscriptionPlans from './pages/SubscriptionPlans';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import BonusCredits from './pages/BonusCredits';
// import Intro from './pages/Intro';
//

import { loadStripe } from '@stripe/stripe-js';

import './styles.css';
import { ToastProvider } from './contexts/ToastContext';
import { FingerprintProvider } from './contexts/FingerprintContext';
import ErrorBoundary from './components/ErrorBoundary';

// import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { GA_TRACKING_ID, pageview } from './utils/gtag';


// A component to track page views
function TrackPageViews() {
  const location = useLocation();
  React.useEffect(() => {
    if (GA_TRACKING_ID) {
      pageview(location.pathname);
    }
  }, [location]);
  return null;
}

export default function App() {


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <ToastProvider>
          <FingerprintProvider>
            <BrowserRouter>
              <TrackPageViews />
              <NavBar />
            <Routes>

            {/* Public Routes */}
         
            <>
              <Route path="/login" element={<Auth isLogin={true} />} />
              <Route path="/register" element={<Auth isLogin={false} />} />
            </>
        
            <Route path="/help" element={<HelpPage />} />
            <Route path="/info" element={<Info />} />
          

            {/* Purchase Credits Routes */}
          
            <>
              <Route path="/purchase-crypto" element={<PurchaseCrypto />} />
              <Route path="/purchase-stripe" element={<PurchaseStripe />} />
              <Route path="/purchase-paypal" element={<PurchasePaypal />} />
              <Route path="/purchase-cashapp" element={<PurchaseCashApp />} />
              <Route path="/purchase-history" element={<PurchaseHistory />} />
              <Route path="/account" element={<Account />} />
            </>
       
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
              <ProtectedRoute> <StripeCheckoutForm /> </ProtectedRoute>} />
            {/* <Route path="/stripe-checkout" element={
              <ProtectedRoute> <StripeCheckoutForm credits={5000} amount={5000} currency="usd" description="Purchase of 5000 credits" metadata={{}} priceId="price_1J2Yw2L2g2g2g2" /> </ProtectedRoute>} /> */}
            <Route path="/return" element={
              <ProtectedRoute> <Return /> </ProtectedRoute>} />

            {/* <Route path="/intro" element={<Intro />} /> */}

            {/* Video Editor */}

            <Route path="/video-scrambler" element={<VideoScrambler />} />

            <Route path="/video-scrambler-basic" element={<VideoScramblerBasic />} />

            <Route path="/video-unscrambler" element={<VideoUnscrambler />} />

            <Route path="/video-unscrambler-basic" element={<VideoUnscramblerBasic />} />

            {/* Photo Editor */}

            <Route path="/photo-scrambler" element={<ScramblerPhotos />} />

            <Route path="/photo-unscrambler" element={<UnscramblerPhotos />} />

            {/* Audio Editor Routes (in future) */}

            <Route path="/audio-scrambler" element={<AudioScrambler />} />

            <Route path="/audio-unscrambler" element={<AudioUnscrambler />} />

            {/* Pro services */}

            <Route path="/photo-scrambler-pro" element={<ScramblerPhotosPro />} />

            <Route path="/photo-unscrambler-pro" element={<UnscramblerPhotosPro />} />


            <Route path="/video-scrambler-pro" element={<VideoScramblerPro />} />

            <Route path="/video-unscrambler-pro" element={<VideoUnscramblerPro />} />

            {/* Leak Checkers */}
            <Route path="/photo-leak-checker" element={<PhotoLeakChecker />} />

            <Route path="/video-leak-checker" element={<VideoLeakChecker />} />

            <Route path="/audio-leak-checker" element={<AudioLeakChecker />} />

            {/* Subscription Plans */}
            <Route path="/subscription/plans" element={<SubscriptionPlans />} />

            <Route path="/subscription/success" element={<SubscriptionSuccess />} />

            <Route path="/bonus-credits" element={<BonusCredits />} />

            {/* need a redirect or fallback route if not logged in and the user tries to visit a protected route */}
            <Route path="*" element={<LoadingPage />} />


          </Routes>
        </BrowserRouter>
        </FingerprintProvider>
      </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
