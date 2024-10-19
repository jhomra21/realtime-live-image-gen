import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import Together from 'together-ai'
import { Redis } from '@upstash/redis/cloudflare'
import { Ratelimit } from '@upstash/ratelimit'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const app = new Hono()

const API_LOCAL_URL = 'http://127.0.0.1:8787'

// Apply CORS middleware to all routes
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://realtime-live-image-gen.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))



app.post('/api/generateImages', async (c) => {
  // Set CORS headers manually
  c.header('Access-Control-Allow-Origin', 'https://realtime-live-image-gen.pages.dev')
  c.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type')
  c.header('Access-Control-Max-Age', '600')

  // Handle OPTIONS request for CORS preflight
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }

  const options: ConstructorParameters<typeof Together>[0] = {
    apiKey: (c.env as any).TOGETHER_API_KEY || process.env.TOGETHER_API_KEY,
  }
  // const redis = new Redis({
  //   url: (c.env as any).UPSTASH_REDIS_REST_URL,
  //   token: (c.env as any).UPSTASH_REDIS_REST_TOKEN,
  // })
  //---------------- use this for local testing --------------------------------
  const redis = new Redis({
    url: (c.env as any).UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: (c.env as any).UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  })

  const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.fixedWindow(100, "1440 m"),
    analytics: true,
    prefix: "juan-realtime-image-gen",
  })

  const client = new Together(options)

  const schema = z.object({
    prompt: z.string(),
    userAPIKey: z.string().optional(),
    iterativeMode: z.boolean().optional().default(false),
    model: z.string().optional().default('black-forest-labs/FLUX.1-schnell-Free'),
  })

  try {
    const body = await c.req.json()
    const { prompt, userAPIKey, iterativeMode, model } = schema.parse(body)

    let selectedModel = 'black-forest-labs/FLUX.1-schnell-Free'

    if (userAPIKey) {
      client.apiKey = userAPIKey
      selectedModel = model // Only use the selected model if a user API key is provided
    }

    if (ratelimit && !userAPIKey) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0] || c.req.header('x-real-ip') || '0.0.0.0'
      const { success } = await ratelimit.limit(ip)
      if (!success) {
        return c.json({ error: "No requests left. Please add your own API key or try again in 24h." }, 429)
      }
    }

    const response = await client.images.create({
      prompt,
      model: selectedModel,
      width: 1024,
      height: 768,
      steps: 2,
      seed: iterativeMode ? 123 : undefined,
      // @ts-expect-error - this is not typed in the API
      response_format: "base64",
    })

    return c.json(response.data[0])
  } catch (error: any) {
    console.error('Error generating image:', error)
    return c.json({ error: error.toString() }, 500)
  }
})

const imageSchema = z.object({
  image: z.instanceof(File)
});

app.post('/api/uploadImage', async (c) => {
  try {
    const formData = await c.req.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const bucket = (c.env as any).USER_IMAGES_BUCKET || process.env.USER_IMAGES_BUCKET;
    const r2PublicDomain = (c.env as any).R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_DOMAIN;

    if (!bucket || typeof bucket.put !== 'function') {
      console.error('R2 bucket not properly configured:', bucket);
      throw new Error('R2 bucket not properly configured');
    }

    // Generate a unique filename
    const filename = `image_${Date.now()}_${image.name}`;

    // Read the file content
    const arrayBuffer = await image.arrayBuffer();

    await bucket.put(filename, arrayBuffer, {
      httpMetadata: { contentType: image.type },
    });

    const publicUrl = `https://${r2PublicDomain}/${filename}`;
    return c.json({ url: publicUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    return c.json({ error: 'Failed to upload image', details: error instanceof Error ? error.message : String(error) }, 500);
  }
})

app.get('/twitter/auth/callback', async (c) => {
  console.log('Entering Twitter auth callback');
  const { code, state } = c.req.query();
  
  const schema = z.object({
    code: z.string(),
    state: z.string(),
  });

  const validationResult = schema.safeParse({ code, state });

  if (!validationResult.success) {
    console.error('Validation error:', validationResult.error);
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=invalid_parameters`);
  }

  const { code: validCode, state: validState } = validationResult.data;

  const decodedState = JSON.parse(Buffer.from(validState, 'base64').toString());
  const validUserId = decodedState.userId;
  const codeVerifier = decodedState.codeVerifier;

  const supabase = createClient(
    (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  )
  console.log('Supabase client initialized');

  try {
    console.log('Exchanging code for tokens with Twitter');
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
    const clientId = (c.env as any).TWITTER_CLIENT_ID || process.env.TWITTER_CLIENT_ID;
    const clientSecret = (c.env as any).TWITTER_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET;
    // change this to your local url when testing
    const redirectUri = `${API_LOCAL_URL}/twitter/auth/callback`;
    // const redirectUri = `https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/callback`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: validCode,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    });

    const accessTokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: params
    });

    if (!accessTokenResponse.ok) {
      const errorText = await accessTokenResponse.text();
      console.error('Failed to obtain access token:', accessTokenResponse.status, errorText);
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=access_token_failure&details=${encodeURIComponent('Failed to obtain access token from Twitter. Please check server logs for more details.')}`);
    }

    const tokenData = await accessTokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Fetch user details
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user details:', userResponse.status);
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=user_details_failure`);
    }

    const userData = await userResponse.json();
    const twitterUserId = userData.data.id;
    const screenName = userData.data.username;
    const name = userData.data.name;

    // Check for existing link
    const { data: existingLinks, error: linkError } = await supabase
      .from('user_linked_accounts')
      .select('*')
      .eq('user_id', validUserId)
      .eq('provider', 'twitter')
      .eq('provider_account_id', twitterUserId);

    if (linkError) {
      console.error('Error checking for existing link:', linkError);
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=database_error`);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    if (existingLinks && existingLinks.length > 0) {
      // Update the existing link
      const { error: updateError } = await supabase
        .from('user_linked_accounts')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          username: screenName,
          name: name,
        })
        .eq('id', existingLinks[0].id);

      if (updateError) {
        console.error('Error updating existing link:', updateError);
        return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=database_error`);
      }
    } else {
      // Insert new link
      const { error: insertError } = await supabase
        .from('user_linked_accounts')
        .insert({
          user_id: validUserId,
          provider: 'twitter',
          provider_account_id: twitterUserId,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          username: screenName,
          name: name,
        });

      if (insertError) {
        console.error('Error inserting new link:', insertError);
        return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=database_error`);
      }
    }

    console.log('Twitter account linked successfully:', {
      userId: validUserId,
      twitterUserId,
      screenName,
      expiresAt
    });
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/generate?message=link_success`);
  } catch (error) {
    console.error('Unexpected error linking Twitter account:', error);
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=unexpected_error`);
  }
});

// Add this new route to initiate the Twitter OAuth flow
app.get('/twitter/auth', async (c) => {
  // Set CORS headers
  c.header('Access-Control-Allow-Origin', 'https://realtime-live-image-gen.pages.dev');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request for CORS preflight
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  // change this to your local url when testing
  const callbackUrl = `${API_LOCAL_URL}/twitter/auth/callback`;
  // const callbackUrl = 'https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/callback';
  const clientId = (c.env as any).TWITTER_CLIENT_ID || process.env.TWITTER_CLIENT_ID;
  const authorizationUrl = 'https://twitter.com/i/oauth2/authorize';

  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store the code verifier in a secure way (e.g., encrypted in the state or in a database)
  const state = Buffer.from(JSON.stringify({ userId: user.id, codeVerifier })).toString('base64');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'tweet.read users.read offline.access tweet.write',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  const authUrl = `${authorizationUrl}?${params.toString()}`;
  return c.json({ authUrl });
});

async function generateCodeChallenge(codeVerifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function generateCodeVerifier() {
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID();
  return codeVerifier;
}

app.post('/twitter/post', async (c) => {
  const schema = z.object({
    text: z.string().max(280),
    accountUsername: z.string(),
  });

  try {
    const body = await c.req.json();
    const { text, accountUsername } = schema.parse(body);

    // Get the authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    const supabase = createClient(
      (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );

    // Get user from session using the token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    // Fetch the user's Twitter account details
    const { data: account, error: accountError } = await supabase
      .from('user_linked_accounts')
      .select('*')
      .eq('username', accountUsername)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return c.json({ error: 'Twitter account not found' }, 404);
    }

    // Check if the token is expired and refresh if necessary
    if (new Date(account.expires_at) <= new Date()) {
      console.log('Token expired, attempting to refresh');
      const refreshedTokens = await refreshTwitterToken(account.refresh_token, c);
      if (!refreshedTokens) {
        console.error('Failed to refresh Twitter token');
        return c.json({ error: 'Failed to refresh Twitter token' }, 401);
      }

      // Update the account with new tokens
      const { error: updateError } = await supabase
        .from('user_linked_accounts')
        .update({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token,
          expires_at: new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString(),
        })
        .eq('id', account.id);

      if (updateError) {
        console.error('Error updating tokens:', updateError);
        return c.json({ error: 'Failed to update tokens' }, 500);
      }

      account.access_token = refreshedTokens.access_token;
    }

    // Post the tweet using the potentially refreshed token
    const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!tweetResponse.ok) {
      const errorData = await tweetResponse.json();
      console.error('Twitter API error:', errorData);
      return c.json({ error: 'Failed to post tweet', details: errorData }, tweetResponse.status as any);
    }

    const tweetData = await tweetResponse.json();
    return c.json({ success: true, tweet: tweetData.data });
  } catch (error) {
    console.error('Error posting tweet:', error);
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request data', details: error.issues }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add this function to refresh the Twitter token
async function refreshTwitterToken(refreshToken: string, c: any) {
  const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
  const clientId = (c.env as any).TWITTER_CLIENT_ID || process.env.TWITTER_CLIENT_ID;
  const clientSecret = (c.env as any).TWITTER_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: params
    });

    if (!response.ok) {
      console.error('Failed to refresh token:', response.status, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export default app
