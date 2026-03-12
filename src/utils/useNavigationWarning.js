/**
 * useNavigationWarning - Custom hook to warn users before navigating away
 * 
 * Shows a browser confirmation dialog when user tries to leave the page
 * without saving their work. Alert is shown only once per day per storage key.
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.shouldWarn - Whether to show the warning (e.g., has unsaved work)
 * @param {string} options.message - Custom warning message to display
 * @param {string} options.storageKey - Unique localStorage key for this component (default: 'navigationWarningLastAlert')
 * @param {number} options.cooldownHours - Hours before showing warning again (default: 24)
 * 
 * @example
 * // Basic usage
 * useNavigationWarning({
 *   shouldWarn: hasScrambledContent && !hasDownloaded,
 *   message: 'Make sure you downloaded your files!',
 *   storageKey: 'videoScramblerAlert'
 * });
 */

import { useEffect } from 'react';

export const useNavigationWarning = ({
  shouldWarn = false,
  message = 'You have unsaved changes. Are you sure you want to leave?',
  storageKey = 'navigationWarningLastAlert',
  cooldownHours = 24
}) => {
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!shouldWarn) return;

      // Check localStorage for last alert timestamp
      const lastAlertTime = localStorage.getItem(storageKey);
      const now = Date.now();
      const cooldownMs = cooldownHours * 60 * 60 * 1000;

      // Show alert only if cooldown period has passed (or never shown)
      if (!lastAlertTime || (now - parseInt(lastAlertTime)) > cooldownMs) {
        event.preventDefault();
        event.returnValue = message; // Chrome requires returnValue to be set
        
        // Store the new timestamp
        localStorage.setItem(storageKey, now.toString());
        
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldWarn, message, storageKey, cooldownHours]);
};

export default useNavigationWarning;
