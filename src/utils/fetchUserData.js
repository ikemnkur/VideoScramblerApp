// fetchUserData.js - Utility function to get user data from localStorage

import api from '../api/client';

/**
 * Fetch user data from localStorage
 * @returns {Object|null} User data object or null if not found
 */
export async function fetchUserData() {
  try {
    let userDataStr = localStorage.getItem('userdata');
    let userData = userDataStr ? JSON.parse(userDataStr) : null;

    if (!userData || !userData.username || !userData.email) {
      console.warn('No valid user data in localStorage');

      const protectedRoute = (window.location.pathname !== '/login')
        && (window.location.pathname !== '/info')
        && (window.location.pathname !== '/')
        && (window.location.pathname !== '/help')
        && (window.location.pathname !== '/register');

      if (protectedRoute) {
        alert('Session Expired. No user data found. Please login again.');
        setTimeout(() => { window.location.href = '/login'; }, 1000);
      }
      return null;
    }

    console.log("Fetching user data for:", userData.username, userData.email);

    const response = await api.post(`api/user`, {
      username: userData.username,
      email: userData.email,
      password: localStorage.getItem('hashedPassword')
    });

    console.log("API user response:", response);

    if (response.data && response.data.success) {
      console.log("User profile response data:", response.data);
      localStorage.setItem('userdata', JSON.stringify(response.data.user || {}));
      localStorage.setItem('lastDataFetch', Date.now().toString());

      if (response.data.dayPassExpiry) {
        localStorage.setItem('dayPassExpiry', response.data.dayPassExpiry);
      } else {
        localStorage.removeItem('dayPassExpiry');
      }

      if (response.data.dayPassMode && new Date(response.data.dayPassExpiry) > new Date()) {
        localStorage.setItem('dayPassMode', response.data.dayPassMode);
      } else {
        localStorage.setItem('dayPassMode', 'free');
      }

      return response.data.user;
    } else {
      throw new Error('Failed to fetch user data');
    }

  } catch (err) {
    console.error('Error fetching user data:', err);

    const protectedRoute = (window.location.pathname !== '/login')
      && (window.location.pathname !== '/info')
      && (window.location.pathname !== '/')
      && (window.location.pathname !== '/help')
      && (window.location.pathname !== '/register');

    if (protectedRoute) {
      alert('Session Expired. Unable to fetch user data. Please login again.');
      setTimeout(() => { window.location.href = '/login'; }, 1000);
    }
    return null;
  }
}

