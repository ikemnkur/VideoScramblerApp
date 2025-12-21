/**
 * FingerprintProvider.jsx - React Context Provider for Device Fingerprinting
 * 
 * Provides device fingerprint data throughout the application
 * Use this to track which device/account unscrambled content for leak prevention
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import DeviceFingerprint from '../utils/DeviceFingerprint';

const FingerprintContext = createContext(null);

export const FingerprintProvider = ({ children }) => {
  const [fingerprint, setFingerprint] = useState(null);
  const [compactFingerprint, setCompactFingerprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001'; 

  useEffect(() => {
    generateFingerprint();
  }, []);

  const generateFingerprint = async () => {
    try {
      setLoading(true);
      const fp = await DeviceFingerprint.generate();
      setFingerprint(fp);
      
      // Get user info from localStorage if available
      const userInfo = getUserInfo();
      const compact = await DeviceFingerprint.getCompactFingerprint(userInfo);
      setCompactFingerprint(compact);
      
      setLoading(false);
    } catch (err) {
      console.error('Error generating fingerprint:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const getUserInfo = () => {
    try {
      const userData = localStorage.getItem('userdata');
      if (userData) {
        const user = JSON.parse(userData);
        return {
          userId: user.id || user.userId,
          username: user.username,
          email: user.email
        };
      }
    } catch (e) {
      console.error('Error getting user info:', e);
    }
    return {};
  };

  const getEmbeddableFingerprint = () => {
    if (!compactFingerprint) return null;
    return DeviceFingerprint.encodeForEmbedding(compactFingerprint);
  };

  const decodeFingerprint = (encoded) => {
    return DeviceFingerprint.decodeFromEmbedding(encoded);
  };

  const refreshFingerprint = () => {
    generateFingerprint();
  };

  /**
   * Submit fingerprint to backend after login
   * Call this after successful authentication
   */
  const submitFingerprint = async (userId, maxRetries = 10, retryDelay = 500) => {
    console.log('🚀 Submitting fingerprint for user:', userId);
    
    if (!userId) {
      console.error('User ID is required to submit fingerprint');
      return { success: false, message: 'User ID required' };
    }

    // Wait for fingerprint to be ready with retries
    let retries = 0;
    while ((!fingerprint || !compactFingerprint) && retries < maxRetries) {
      console.log(`⏳ Waiting for fingerprint to be ready... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retries++;
    }

    if (!fingerprint || !compactFingerprint) {
      console.error('❌ Fingerprint not ready after waiting. Cannot submit.');
      return { success: false, message: 'Fingerprint generation timed out' };
    }

    console.log('✅ Fingerprint ready, proceeding with submission');

    try {
      
      const payload = {
        userId: userId,
        fingerprintHash: fingerprint.hash,
        shortHash: fingerprint.shortHash,
        deviceType: fingerprint.device?.type || 'Unknown',
        browser: `${fingerprint.browser?.name || 'Unknown'} ${fingerprint.browser?.version || ''}`.trim(),
        os: fingerprint.device?.platform || 'Unknown',
        screenResolution: fingerprint.screen ? 
          `${fingerprint.screen.width}x${fingerprint.screen.height}` : 'Unknown',
        timezone: fingerprint.timezone?.timezone || 'UTC',
        language: fingerprint.language?.language || 'en-US',
        ipAddress: fingerprint.network?.ipInfo?.ip || null,
        fullFingerprint: fingerprint,
        compactFingerprint: compactFingerprint,
        userAgent: fingerprint.browser?.userAgent || navigator.userAgent
      };

      console.log('📤 Submitting fingerprint to backend:', {
        userId,
        hash: payload.shortHash,
        device: payload.deviceType,
        browser: payload.browser
      });

      const response = await fetch(`${API_URL}/api/fingerprint/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Fingerprint submitted successfully');
        return { success: true, data };
      } else {
        console.error('❌ Failed to submit fingerprint:', data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('❌ Error submitting fingerprint:', error);
      return { 
        success: false, 
        message: error.message || 'Network error' 
      };
    }
  };

  /**
   * Get user's device history from backend
   */
  const getUserDevices = async (userId) => {
    if (!userId) {
      return { success: false, message: 'User ID required' };
    }

    try {
         
      const response = await fetch(`${API_URL}/api/fingerprint/user/${userId}`);
      const data = await response.json();

      if (data.success) {
        return { success: true, devices: data.fingerprints };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Error fetching user devices:', error);
      return { 
        success: false, 
        message: error.message || 'Network error' 
      };
    }
  };

  /**
   * Increment unscramble count when user unscrambles content
   * Call this when content is unscrambled with this device
   */
  const recordUnscramble = async () => {
    if (!fingerprint) {
      return { success: false, message: 'Fingerprint not ready' };
    }

    try {
           
      const response = await fetch(
        `${API_URL}/api/fingerprint/unscramble/${fingerprint.hash}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error recording unscramble:', error);
      return { success: false, message: error.message };
    }
  };

  const value = {
    fingerprint,
    compactFingerprint,
    loading,
    error,
    getEmbeddableFingerprint,
    decodeFingerprint,
    refreshFingerprint,
    submitFingerprint,
    getUserDevices,
    recordUnscramble
  };

  return (
    <FingerprintContext.Provider value={value}>
      {children}
    </FingerprintContext.Provider>
  );
};

export const useFingerprint = () => {
  const context = useContext(FingerprintContext);
  if (!context) {
    throw new Error('useFingerprint must be used within FingerprintProvider');
  }
  return context;
};

export default FingerprintProvider;
