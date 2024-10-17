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
    // const redirectUri = `${API_LOCAL_URL}/twitter/auth/callback`;
    const redirectUri = `https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/callback`;

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

    console.log('Twitter account linked successfully');
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
  // const callbackUrl = `${API_LOCAL_URL}/twitter/auth/callback`;
  const callbackUrl = 'https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/callback';
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
    scope: 'tweet.read users.read offline.access',
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

// Add this new route to handle Twitter image upload and tweeting
app.post('/api/twitter/post', async (c) => {
  // Set CORS headers
  c.header('Access-Control-Allow-Origin', 'https://realtime-live-image-gen.pages.dev')
  c.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle OPTIONS request for CORS preflight
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }

  const schema = z.object({
    userId: z.string().uuid(),
    twitterAccountId: z.string(),
    imageUrl: z.string().url(),
    tweetText: z.string().max(280),
  })

  try {
    const body = await c.req.json();
    console.log('Received data:', body); // Log the received data

    const { userId, twitterAccountId, imageUrl, tweetText } = schema.parse(body);
    
    const supabase = createClient(
      (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    )

    // Fetch the user's Twitter access token
    const { data: accountData, error: accountError } = await supabase
      .from('user_linked_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'twitter')
      .eq('id', twitterAccountId)
      .single()

    if (accountError) {
      console.error('Error fetching Twitter account data:', accountError);
      return c.json({ error: 'Failed to fetch Twitter account data', details: accountError.message }, 400)
    }

    if (!accountData) {
      return c.json({ error: 'Twitter account not found' }, 404)
    }

    // Check if the token is expired and refresh if necessary
    if (new Date(accountData.expires_at) <= new Date()) {
      const refreshedToken = await refreshTwitterToken(c, accountData.refresh_token, userId, twitterAccountId)
      if (!refreshedToken) {
        return c.json({ error: 'Failed to refresh Twitter token' }, 400)
      }
      accountData.access_token = refreshedToken
    }

    // Upload the image to Twitter
    const mediaId = await uploadImageToTwitter(imageUrl, accountData.access_token)
    if (!mediaId) {
      return c.json({ error: 'Failed to upload image to Twitter' }, 500)
    }

    // Post the tweet with the uploaded image
    const tweetResult = await postTweet(tweetText, mediaId, accountData.access_token)
    if (!tweetResult) {
      return c.json({ error: 'Failed to post tweet' }, 500)
    }

    return c.json({ success: true, tweetId: tweetResult.id })
  } catch (error: any) {
    console.error('Error posting to Twitter:', error)
    return c.json({ error: error.toString(), details: error.message }, 500)
  }
})

async function refreshTwitterToken(c: any, refreshToken: string, userId: string, accountId: string) {
  const tokenUrl = 'https://api.twitter.com/2/oauth2/token'
  const clientId = (c.env as any).TWITTER_CLIENT_ID || process.env.TWITTER_CLIENT_ID
  const clientSecret = (c.env as any).TWITTER_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  })

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: params
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Update the token in the database
    const supabase = createClient(
      (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await supabase
      .from('user_linked_accounts')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
      })
      .eq('user_id', userId)
      .eq('id', accountId)

    if (error) {
      throw new Error('Failed to update token in database')
    }

    return data.access_token
  } catch (error) {
    console.error('Error refreshing Twitter token:', error)
    return null
  }
}

async function uploadImageToTwitter(imageUrl: string, accessToken: string) {
  try {
    // Fetch the image
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()

    // Upload the image to Twitter
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json'
    const formData = new FormData()
    formData.append('media', new Blob([imageBuffer]), 'image.png')

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    })

    if (!uploadResponse.ok) {
      throw new Error(`HTTP error! status: ${uploadResponse.status}`)
    }

    const uploadData = await uploadResponse.json()
    return uploadData.media_id_string
  } catch (error) {
    console.error('Error uploading image to Twitter:', error)
    return null
  }
}

async function postTweet(text: string, mediaId: string, accessToken: string) {
  try {
    const tweetUrl = 'https://api.twitter.com/2/tweets'
    const payload = {
      text: text,
      media: {
        media_ids: [mediaId]
      }
    }

    const response = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error posting tweet:', error)
    return null
  }
}

export default app
