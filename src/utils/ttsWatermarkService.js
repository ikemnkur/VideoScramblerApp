/**
 * TTS Watermark Service
 * Handles generation and application of audio watermarks
 */

const TTS_SERVER_URL = 'http://localhost:5000/';

/**
 * Generate a TTS watermark for audio scrambling/unscrambling
 * @param {string} username - Username to embed in watermark
 * @param {string} type - 'scrambler' or 'unscrambler'
 * @param {object} options - Voice options (voice, rate, pitch)
 * @returns {Promise<string>} URL to the generated watermark audio file
 */
export async function generateWatermark(username, type = 'unscrambler', options = {}) {
  try {
    const {
      voice = 'en-US-GuyNeural',
      rate = '+10%',
      pitch = '+0Hz',
      silence_between = 150
    } = options;

    let intro = '';
    let id_text = '';
    let outro = '';

    if (type === 'scrambler') {
      intro = 'Protected audio by';
      id_text = username;
      outro = 'on scrambler dot com';
    } else if (type === 'unscrambler') {
      intro = 'Unscrambled by user';
      id_text = username;
      outro = 'on scrambler dot com';
    }

    const response = await fetch(`${TTS_SERVER_URL}/tts/generate-watermark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intro,
        id: id_text,
        outro,
        voice,
        rate,
        pitch,
        silence_between
      })
    });

    if (!response.ok) {
      throw new Error(`TTS Server error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate watermark');
    }

    // Return full URL to watermark audio
    return `${TTS_SERVER_URL}${result.url}`;
  } catch (error) {
    console.error('Error generating watermark:', error);
    throw error;
  }
}

/**
 * Load audio from URL and convert to AudioBuffer
 * @param {string} url - URL to audio file
 * @param {AudioContext} audioContext - Web Audio API context
 * @returns {Promise<AudioBuffer>} Decoded audio buffer
 */
export async function loadAudioFromUrl(url, audioContext) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } catch (error) {
    console.error('Error loading audio from URL:', error);
    throw error;
  }
}

/**
 * Prepend watermark to audio (for scrambler - watermark at start)
 * @param {AudioBuffer} originalBuffer - Original audio buffer
 * @param {AudioBuffer} watermarkBuffer - Watermark audio buffer
 * @param {AudioContext} audioContext - Web Audio API context
 * @returns {AudioBuffer} Combined audio with watermark at start
 */
export function prependWatermark(originalBuffer, watermarkBuffer, audioContext) {
  const channels = originalBuffer.numberOfChannels;
  const sampleRate = originalBuffer.sampleRate;
  
  // Resample watermark if sample rates don't match
  const watermark = watermarkBuffer.sampleRate === sampleRate 
    ? watermarkBuffer 
    : resampleBuffer(watermarkBuffer, sampleRate, audioContext);

  const totalLength = watermark.length + originalBuffer.length;
  const combinedBuffer = audioContext.createBuffer(channels, totalLength, sampleRate);

  for (let channel = 0; channel < channels; channel++) {
    const combinedData = combinedBuffer.getChannelData(channel);
    const watermarkData = watermark.getChannelData(Math.min(channel, watermark.numberOfChannels - 1));
    const originalData = originalBuffer.getChannelData(channel);

    // Copy watermark
    combinedData.set(watermarkData, 0);
    
    // Copy original audio after watermark
    combinedData.set(originalData, watermark.length);
  }

  return combinedBuffer;
}

/**
 * Overlay watermark at regular intervals throughout audio (for unscrambler)
 * @param {AudioBuffer} originalBuffer - Original audio buffer
 * @param {AudioBuffer} watermarkBuffer - Watermark audio buffer
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {object} options - Overlay options
 * @returns {AudioBuffer} Audio with watermark overlays
 */
export function overlayWatermarkAtIntervals(originalBuffer, watermarkBuffer, audioContext, options = {}) {
  const {
    intervalSeconds = null, // Auto-calculate if null
    volume = 0.3, // Watermark volume (0.0 to 1.0)
    fadeMs = 200 // Fade in/out duration in milliseconds
  } = options;

  const channels = originalBuffer.numberOfChannels;
  const sampleRate = originalBuffer.sampleRate;
  const duration = originalBuffer.duration;
  
  // Resample watermark if needed
  const watermark = watermarkBuffer.sampleRate === sampleRate 
    ? watermarkBuffer 
    : resampleBuffer(watermarkBuffer, sampleRate, audioContext);

  // Calculate interval based on audio length
  let interval = intervalSeconds;
  if (interval === null) {
    if (duration <= 30) {
      interval = 15; // Every 15 seconds for short audio
    } else if (duration <= 120) {
      interval = 20; // Every 20 seconds for medium audio
    } else {
      interval = 15; // Every 15 seconds for long audio
    }
  }

  // Create output buffer (same length as original)
  const outputBuffer = audioContext.createBuffer(channels, originalBuffer.length, sampleRate);

  // Copy original audio
  for (let channel = 0; channel < channels; channel++) {
    const outputData = outputBuffer.getChannelData(channel);
    const originalData = originalBuffer.getChannelData(channel);
    outputData.set(originalData);
  }

  // Calculate positions to overlay watermark
  const intervalSamples = Math.floor(interval * sampleRate);
  const fadeSamples = Math.floor((fadeMs / 1000) * sampleRate);
  
  let position = 0;
  
  while (position + watermark.length < originalBuffer.length) {
    // Overlay watermark at this position
    for (let channel = 0; channel < channels; channel++) {
      const outputData = outputBuffer.getChannelData(channel);
      const watermarkData = watermark.getChannelData(Math.min(channel, watermark.numberOfChannels - 1));
      
      for (let i = 0; i < watermark.length && position + i < originalBuffer.length; i++) {
        let wmSample = watermarkData[i] * volume;
        
        // Apply fade in/out
        if (i < fadeSamples) {
          wmSample *= i / fadeSamples; // Fade in
        } else if (i > watermark.length - fadeSamples) {
          wmSample *= (watermark.length - i) / fadeSamples; // Fade out
        }
        
        // Mix with original audio
        outputData[position + i] += wmSample;
        
        // Prevent clipping
        outputData[position + i] = Math.max(-1, Math.min(1, outputData[position + i]));
      }
    }
    
    position += intervalSamples;
  }

  return outputBuffer;
}

/**
 * Simple resampling (basic implementation)
 * @param {AudioBuffer} buffer - Buffer to resample
 * @param {number} targetSampleRate - Target sample rate
 * @param {AudioContext} audioContext - Web Audio API context
 * @returns {AudioBuffer} Resampled buffer
 */
function resampleBuffer(buffer, targetSampleRate, audioContext) {
  const sourceSampleRate = buffer.sampleRate;
  const ratio = targetSampleRate / sourceSampleRate;
  const newLength = Math.round(buffer.length * ratio);
  const channels = buffer.numberOfChannels;
  
  const resampledBuffer = audioContext.createBuffer(channels, newLength, targetSampleRate);
  
  for (let channel = 0; channel < channels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const targetData = resampledBuffer.getChannelData(channel);
    
    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i / ratio;
      const sourceIndexFloor = Math.floor(sourceIndex);
      const sourceIndexCeil = Math.min(sourceIndexFloor + 1, buffer.length - 1);
      const fraction = sourceIndex - sourceIndexFloor;
      
      // Linear interpolation
      targetData[i] = sourceData[sourceIndexFloor] * (1 - fraction) + 
                     sourceData[sourceIndexCeil] * fraction;
    }
  }
  
  return resampledBuffer;
}

/**
 * Check if TTS server is available
 * @returns {Promise<boolean>} True if server is available
 */
export async function checkTTSServerHealth() {
  try {
    const response = await fetch(`${TTS_SERVER_URL}/tts/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    return response.ok;
  } catch (error) {
    console.warn('TTS server not available:', error.message);
    return false;
  }
}

/**
 * Generate speech audio using Google Translate TTS API (via backend proxy)
 * @param {string} text - Text to convert to speech
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {object} options - TTS options
 * @returns {Promise<AudioBuffer>} Audio buffer with generated speech
 */
export async function useGoogleTTS(text, audioContext, options = {}) {
  try {
    const {
      language = 'en', // Language code (en, es, fr, etc.)
      speed = 1.0       // Speech speed (not directly supported by Google TTS)
    } = options;

    // Use backend proxy to bypass CORS
    const API_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';
    const url = `${API_URL}/api/tts/google?text=${encodeURIComponent(text)}&language=${language}`;
    
    const response = await fetch(url, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `TTS request failed: ${response.status} ${response.statusText}`);
    }

    // Get audio data as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Decode audio data to AudioBuffer
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log('Google TTS audio generated:', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels
    });
    
    return audioBuffer;
  } catch (error) {
    console.error('Error generating Google TTS:', error.message);
    throw error;
  }
}

/**
 * Generate watermark using Google TTS (fallback when TTS server is unavailable)
 * @param {string} username - Username to embed in watermark
 * @param {string} type - 'scrambler' or 'unscrambler'
 * @param {AudioContext} audioContext - Web Audio API context
 * @returns {Promise<AudioBuffer>} Watermark audio buffer
 */
export async function generateWatermarkWithGoogleTTS(username, type = 'unscrambler', audioContext) {
  try {
    let text = '';
    
    if (type === 'scrambler') {
      text = `Protected audio by ${username} on scrambler dot com`;
    } else if (type === 'unscrambler') {
      text = `Unscrambled by user ${username} on scrambler dot com`;
    }

    const watermarkBuffer = await useGoogleTTS(text, audioContext);
    return watermarkBuffer;
  } catch (error) {
    console.error('Error generating Google TTS watermark:', error);
    throw error;
  }
}



export default {
  generateWatermark,
  loadAudioFromUrl,
  prependWatermark,
  overlayWatermarkAtIntervals,
  checkTTSServerHealth,
  useGoogleTTS,
  generateWatermarkWithGoogleTTS
};
