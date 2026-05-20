import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

const CACHE_NAME = 'username-audio-tags';

// translate.googleapis.com (not translate.google.com) returns
// Access-Control-Allow-Origin: * with client=gtx, so browsers can fetch it
// directly — each user's IP is used instead of the server's.
const GTTS_URL = 'https://translate.googleapis.com/translate_tts';

/**
 * Try to fetch the username MP3 directly from Google Translate TTS using
 * the user's own browser IP (no server involved, no server-side rate limit).
 */
async function fetchClientSide(username) {
  const params = new URLSearchParams({
    ie: 'UTF-8',
    q: username,
    tl: 'en',
    client: 'gtx',
    ttsspeed: '0.9'
  });
  const response = await fetch(`${GTTS_URL}?${params}`);
  if (!response.ok) throw new Error(`Google TTS status ${response.status}`);
  return await response.arrayBuffer();
}

/**
 * Server-side fallback — uses the server's IP but is always available
 * if Google blocks the direct browser request.
 */
async function fetchViaServer() {
  const response = await api.get('/api/tts/username-audio', {
    responseType: 'arraybuffer'
  });
  return response.data;
}

/**
 * Blank loading page shown immediately after login.
 * Tries Google TTS directly from the browser (user's IP) first;
 * falls back to the server proxy if CORS or rate-limit blocks it.
 * Result is stored in the Cache API for use as a watermark.
 */
export default function CreateAudioTag() {
  const { user } = useAuth();
  const nav = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      try {
        const username = user?.username || user?.email?.split('@')[0];

        if (!username) {
          nav('/');
          return;
        }

        // Skip generation if already cached for this username
        if ('caches' in window) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(username);
          if (cached) {
            nav('/');
            return;
          }
        }

        // 1. Try direct client-side fetch (user's IP, no server cost)
        let audioData;
        let source = 'client';
        try {
          audioData = await fetchClientSide(username);
          console.log('[CreateAudioTag] Generated via client-side Google TTS');
        } catch (clientErr) {
          // CORS blocked or rate-limited — fall back to server proxy
          console.warn('[CreateAudioTag] Client-side TTS failed, using server fallback:', clientErr.message);
          audioData = await fetchViaServer();
          source = 'server';
          console.log('[CreateAudioTag] Generated via server proxy');
        }

        // 2. Store in Cache API keyed by username
        if ('caches' in window) {
          const cache = await caches.open(CACHE_NAME);
          const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
          await cache.put(
            username,
            new Response(audioBlob, {
              headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'private, max-age=604800',
                'X-Audio-Tag-Source': source
              }
            })
          );
          console.log(`[CreateAudioTag] Cached audio tag for "${username}" (source: ${source})`);
        }
      } catch (err) {
        // Non-fatal — just log and move on
        console.warn('[CreateAudioTag] Could not create audio tag:', err.message);
      } finally {
        nav('/');
      }
    };

    run();
  }, [user, nav]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2
      }}
    >
      <CircularProgress size={40} />
      <Typography variant="body2" color="text.secondary">
        Setting up your account…
      </Typography>
    </Box>
  );
}

/**
 * Helper — retrieve the cached audio tag for a given username as an ArrayBuffer.
 * Returns null if not yet generated.
 */
export async function getCachedAudioTag(username) {
  if (!('caches' in window) || !username) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(username);
    if (!response) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}
