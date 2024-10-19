import { createEffect } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

const TwitterCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  createEffect(async () => {
    const oauth_token = searchParams.oauth_token;
    const oauth_verifier = searchParams.oauth_verifier;
    const state = localStorage.getItem('twitterAuthState');

    if (!oauth_token || !oauth_verifier || !state) {
      console.error('Missing required parameters');
      navigate('/twitter-linked-error?error=missing_parameters');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Complete OAuth 1.0a flow
      const response = await fetch(`${API_BASE_URL}/twitter/complete-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ oauth_token, oauth_verifier, state })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete Twitter authentication');
      }

      // Clear the state from localStorage
      localStorage.removeItem('twitterAuthState');

      // Initiate OAuth 2.0 flow
      const oauth2Response = await fetch(`${API_BASE_URL}/twitter/auth/v2`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!oauth2Response.ok) {
        const errorData = await oauth2Response.json();
        throw new Error(errorData.error || 'Failed to initiate OAuth 2.0 authentication');
      }

      const { authUrl } = await oauth2Response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error completing Twitter auth:', error);
      navigate('/twitter-linked-error?error=auth_completion_failed');
    }
  });

  return <div>Completing Twitter authentication...</div>;
};

export default TwitterCallback;
