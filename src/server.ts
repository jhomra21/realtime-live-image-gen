import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import Together from 'together-ai'
import { Redis } from '@upstash/redis/cloudflare'
import { Ratelimit } from '@upstash/ratelimit'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { generateCodeVerifier, generateCodeChallenge } from '@/utils/oauth'

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

function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

async function signOAuth1Request(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  tokenKey?: string,
  tokenSecret?: string
) {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };

  if (tokenKey) {
    oauthParams['oauth_token'] = tokenKey;
  }

  const allParams = { ...params, ...oauthParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${tokenSecret ? encodeURIComponent(tokenSecret) : ''}`;

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  oauthParams['oauth_signature'] = signature;

  // Only include OAuth params in the Authorization header
  const authorizationHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authorizationHeader;
}

// Helper function to upload media to Twitter
async function uploadMediaToTwitter(imageUrl: string, consumerKey: string, consumerSecret: string, accessToken: string, accessTokenSecret: string) {
  console.log('Uploading media from URL:', imageUrl);

  // Fetch the image data
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    console.error('Failed to fetch image:', imageResponse.status, await imageResponse.text());
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  console.log('Image size:', imageBuffer.byteLength, 'bytes');

  const mediaUploadInitUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  
  // Initialize the upload
  const initParams = {
    command: 'INIT',
    total_bytes: imageBuffer.byteLength.toString(),
    media_type: 'image/png', // Adjust this based on your image type
  };
  
  const initAuthHeader = await signOAuth1Request(
    'POST',
    mediaUploadInitUrl,
    initParams,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );
  
  const initResponse = await fetch(mediaUploadInitUrl, {
    method: 'POST',
    headers: {
      'Authorization': initAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(initParams),
  });
  
  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    console.error('Failed to initialize media upload:', initResponse.status, errorText);
    throw new Error(`Failed to initialize media upload: ${initResponse.status} ${errorText}`);
  }
  
  const initData = await initResponse.json();
  console.log('Init response:', JSON.stringify(initData, null, 2));
  const { media_id_string } = initData;
  
  // Append the media data
  const appendUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const formData = new FormData();
  formData.append('command', 'APPEND');
  formData.append('media_id', media_id_string);
  formData.append('segment_index', '0');
  formData.append('media', new Blob([imageBuffer]), 'image.png');
  
  const appendAuthHeader = await signOAuth1Request(
    'POST',
    appendUrl,
    {},
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );
  
  const appendResponse = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      'Authorization': appendAuthHeader,
    },
    body: formData,
  });
  
  if (!appendResponse.ok) {
    const errorText = await appendResponse.text();
    console.error('Failed to append media data:', appendResponse.status, errorText);
    throw new Error(`Failed to append media data: ${appendResponse.status} ${errorText}`);
  }
  
  // Finalize the upload
  const finalizeUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const finalizeParams = {
    command: 'FINALIZE',
    media_id: media_id_string,
  };
  
  const finalizeAuthHeader = await signOAuth1Request(
    'POST',
    finalizeUrl,
    finalizeParams,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );
  
  const finalizeResponse = await fetch(finalizeUrl, {
    method: 'POST',
    headers: {
      'Authorization': finalizeAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(finalizeParams),
  });
  
  if (!finalizeResponse.ok) {
    const errorText = await finalizeResponse.text();
    console.error('Failed to finalize media upload:', finalizeResponse.status, errorText);
    throw new Error(`Failed to finalize media upload: ${finalizeResponse.status} ${errorText}`);
  }
  
  const finalizeData = await finalizeResponse.json();
  console.log('Finalize response:', JSON.stringify(finalizeData, null, 2));
  
  // Check if the media is already processed
  if (finalizeData.processing_info && finalizeData.processing_info.state !== 'succeeded') {
    // Only perform STATUS check if the media is not already processed
    const uploadStatus = await checkMediaUploadStatus(media_id_string, consumerKey, consumerSecret, accessToken, accessTokenSecret);
    if (uploadStatus.processing_info && uploadStatus.processing_info.state !== 'succeeded') {
      throw new Error(`Media processing failed: ${JSON.stringify(uploadStatus.processing_info)}`);
    }
  }
  
  return media_id_string;
}

// Add this function after uploadMediaToTwitter
async function checkMediaUploadStatus(mediaId: string, consumerKey: string, consumerSecret: string, accessToken: string, accessTokenSecret: string) {
  const statusUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const params = {
    command: 'STATUS',
    media_id: mediaId
  };
  
  const statusAuthHeader = await signOAuth1Request(
    'GET',
    statusUrl,
    params,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );

  const fullUrl = `${statusUrl}?${new URLSearchParams(params)}`;
  console.log('Checking media upload status:', fullUrl);

  console.log('Status check auth header:', statusAuthHeader);

  const statusResponse = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Authorization': statusAuthHeader,
    },
  });

  console.log('Status response headers:', Object.fromEntries(statusResponse.headers.entries()));
  const responseText = await statusResponse.text();
  console.log('Status response:', statusResponse.status, responseText);

  if (!statusResponse.ok) {
    console.error('Failed to check media upload status:', statusResponse.status, responseText);
    throw new Error(`Failed to check media upload status: ${statusResponse.status} ${responseText}`);
  }

  const statusData = JSON.parse(responseText);
  console.log('Media upload status:', JSON.stringify(statusData, null, 2));

  return statusData;
}

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

// Update the Twitter authentication route for OAuth 1.0a
app.get('/twitter/auth/v1', async (c) => {
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

  // const callbackUrl = `${API_LOCAL_URL}/twitter/auth/v1/callback`;
  const callbackUrl = `https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/v1/callback`;
  
  const consumerKey = (c.env as any).TWITTER_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY;
  const consumerSecret = (c.env as any).TWITTER_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    console.error('Twitter API credentials are missing');
    return c.json({ error: 'Twitter API credentials are not configured' }, 500);
  }

  const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
  const authorizationHeader = await signOAuth1Request(
    'POST',
    requestTokenUrl,
    { oauth_callback: callbackUrl },
    consumerKey,
    consumerSecret
  );

  try {
    // Include oauth_callback as a query parameter
    const response = await fetch(`${requestTokenUrl}?oauth_callback=${encodeURIComponent(callbackUrl)}`, {
      method: 'POST',
      headers: {
        'Authorization': authorizationHeader,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Twitter API error:', response.status, errorBody);
      return c.json({ error: 'Failed to obtain request token', details: errorBody }, response.status as any);
    }

    const responseText = await response.text();
    console.log('Twitter API response:', responseText); // Log for debugging

    const parsedResponse = new URLSearchParams(responseText);
    const oauthToken = parsedResponse.get('oauth_token');
    const oauthTokenSecret = parsedResponse.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Failed to obtain OAuth token and secret');
    }

    const state = Buffer.from(JSON.stringify({ userId: user.id, oauthTokenSecret })).toString('base64');

    const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;
    console.log('Generated state:', state);
    console.log('Auth URL:', authUrl);
    return c.json({ authUrl, state });
  } catch (error) {
    console.error('Detailed error:', error);
    if (error instanceof Error) {
      return c.json({ error: 'Failed to initiate Twitter authentication', details: error.message }, 500);
    } else {
      return c.json({ error: 'Failed to initiate Twitter authentication', details: 'An unknown error occurred' }, 500);
    }
  }
});

// Add a new route for OAuth 2.0 authentication
app.get('/twitter/auth/v2', async (c) => {
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

  // const callbackUrl = `${API_LOCAL_URL}/twitter/auth/v2/callback`;
  const callbackUrl = `https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/v2/callback`;
  const clientId = (c.env as any).TWITTER_CLIENT_ID || process.env.TWITTER_CLIENT_ID;
  const authorizationUrl = 'https://twitter.com/i/oauth2/authorize';

  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

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

// Update the callback route for OAuth 1.0a
app.get('/twitter/auth/v1/callback', async (c) => {
  console.log('Entering Twitter auth callback');
  console.log('Full request URL:', c.req.url);
  const oauth_token = c.req.query('oauth_token');
  const oauth_verifier = c.req.query('oauth_verifier');

  console.log('Received query params:', { oauth_token, oauth_verifier });

  if (!oauth_token || !oauth_verifier) {
    console.error('Missing required parameters');
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=missing_parameters`);
  }

  // Redirect back to the client with the OAuth token and verifier
  return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-callback?oauth_token=${oauth_token}&oauth_verifier=${oauth_verifier}`);
});

// Add a new callback route for OAuth 2.0
app.get('/twitter/auth/v2/callback', async (c) => {
  const { code, state } = c.req.query();
  
  if (!code || !state) {
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=missing_parameters`);
  }

  const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
  const { userId, codeVerifier } = decodedState;

  const supabase = createClient(
    (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
    const clientId = (c.env as any).TWITTER_CLIENT_ID || process.env.TWITTER_CLIENT_ID;
    const clientSecret = (c.env as any).TWITTER_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET;
    // const redirectUri = `${API_LOCAL_URL}/twitter/auth/v2/callback`;
    const redirectUri = `https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/v2/callback`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
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
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=access_token_failure`);
    }

    const tokenData = await accessTokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Update the user_linked_accounts table with OAuth 2.0 tokens
    const { error: updateError } = await supabase
      .from('user_linked_accounts')
      .update({
        access_token,
        refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'twitter');

    if (updateError) {
      console.error('Error updating user_linked_accounts with OAuth 2.0 tokens:', updateError);
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=database_error`);
    }

    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/generate?message=link_success`);
  } catch (error) {
    console.error('Error in OAuth 2.0 callback:', error);
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=unexpected_error`);
  }
});

// Update the tweet posting function to use OAuth 2.0 tokens
app.post('/twitter/post', async (c) => {
  const schema = z.object({
    text: z.string().max(280),
    accountUsername: z.string(),
    imageUrl: z.string().url().optional(),
  });

  try {
    const body = await c.req.json();
    const { text, accountUsername, imageUrl } = schema.parse(body);

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
      const refreshedTokens = await refreshTwitterToken(account.refresh_token, c);
      if (!refreshedTokens) {
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

    let mediaId: string | undefined;
    if (imageUrl) {
      try {
        mediaId = await uploadMediaToTwitter(
          imageUrl,
          (c.env as any).TWITTER_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY,
          (c.env as any).TWITTER_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET,
          account.oauth_token,
          account.oauth_token_secret
        );
      } catch (error) {
        console.error('Error uploading media:', error);
        return c.json({ error: 'Failed to upload media', details: error instanceof Error ? error.message : String(error) }, 500);
      }
    }

    // Post the tweet using OAuth 2.0 token
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    const tweetData = {
      text,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {})
    };

    const tweetResponse = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData),
    });

    if (!tweetResponse.ok) {
      const errorData = await tweetResponse.json();
      console.error('Twitter API error:', errorData);
      return c.json({ error: 'Failed to post tweet', details: errorData }, tweetResponse.status as any);
    }

    const tweetResult = await tweetResponse.json();
    return c.json({ success: true, tweet: tweetResult.data });
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
      const errorText = await response.text();
      console.error('Failed to refresh token:', response.status, errorText);
      return null;
    }

    const tokenData = await response.json();
    console.log('Token refreshed successfully');
    return tokenData;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Add this route after the '/twitter/auth/v1/callback' route

app.post('/twitter/complete-auth', async (c) => {
  const schema = z.object({
    oauth_token: z.string(),
    oauth_verifier: z.string(),
    state: z.string(),
  });

  try {
    const body = await c.req.json();
    const { oauth_token, oauth_verifier, state } = schema.parse(body);

    let decodedState: { userId: string, oauthTokenSecret: string };
    try {
      decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (error) {
      console.error('Error decoding state:', error);
      return c.json({ error: 'Invalid state' }, 400);
    }

    const consumerKey = (c.env as any).TWITTER_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY;
    const consumerSecret = (c.env as any).TWITTER_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET;

    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    const authorizationHeader = await signOAuth1Request(
      'POST',
      accessTokenUrl,
      { oauth_token, oauth_verifier },
      consumerKey,
      consumerSecret,
      oauth_token,
      decodedState.oauthTokenSecret
    );

    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authorizationHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ oauth_token, oauth_verifier }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to obtain access token:', response.status, errorText);
      return c.json({ error: 'Failed to obtain access token', details: errorText }, response.status as any);
    }

    const responseText = await response.text();
    const parsedResponse = new URLSearchParams(responseText);
    const accessToken = parsedResponse.get('oauth_token');
    const accessTokenSecret = parsedResponse.get('oauth_token_secret');
    const userId = parsedResponse.get('user_id');
    const screenName = parsedResponse.get('screen_name');

    if (!accessToken || !accessTokenSecret || !userId || !screenName) {
      throw new Error('Failed to obtain all required tokens and user information');
    }

    const supabase = createClient(
      (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );

    // Check for existing link
    const { data: existingLinks, error: linkError } = await supabase
      .from('user_linked_accounts')
      .select('*')
      .eq('user_id', decodedState.userId)
      .eq('provider', 'twitter')
      .eq('provider_account_id', userId);

    if (linkError) {
      console.error('Error checking for existing link:', linkError);
      return c.json({ error: 'Database error', details: linkError.message }, 500);
    }

    const accountData = {
      user_id: decodedState.userId,
      provider: 'twitter',
      provider_account_id: userId,
      oauth_token: accessToken,
      oauth_token_secret: accessTokenSecret,
      username: screenName,
    };

    let result;
    if (existingLinks && existingLinks.length > 0) {
      // Update the existing link
      result = await supabase
        .from('user_linked_accounts')
        .update(accountData)
        .eq('id', existingLinks[0].id);
    } else {
      // Insert new link
      result = await supabase
        .from('user_linked_accounts')
        .insert(accountData);
    }

    if (result.error) {
      console.error('Error updating/inserting account link:', result.error);
      return c.json({ error: 'Database error', details: result.error.message }, 500);
    }

    console.log('Twitter account linked successfully:', {
      userId: decodedState.userId,
      twitterUserId: userId,
      screenName,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error completing Twitter auth:', error);
    return c.json({ error: 'Failed to complete Twitter authentication', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

export default app
