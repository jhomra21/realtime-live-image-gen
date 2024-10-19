import { createEffect } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

const TwitterCallbackV2 = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  createEffect(async () => {
    const code = searchParams.code;
    const state = searchParams.state;

    if (!code || !state) {
      console.error('Missing required parameters');
      navigate('/twitter-linked-error?error=missing_parameters');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${API_BASE_URL}/twitter/auth/v2/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ code, state })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete Twitter OAuth 2.0 authentication');
      }

      // Redirect to the generate page with a success message
      navigate('/generate?message=link_success');
    } catch (error) {
      console.error('Error completing Twitter OAuth 2.0 auth:', error);
      navigate('/twitter-linked-error?error=auth_completion_failed');
    }
  });

  return <div>Completing Twitter OAuth 2.0 authentication...</div>;
}

export default TwitterCallbackV2;
