import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import Together from 'together-ai'
import { Redis } from '@upstash/redis/cloudflare'
import { Ratelimit } from '@upstash/ratelimit'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const app = new Hono()

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
  const { oauth_token, oauth_verifier, userId } = c.req.query();
  
  const schema = z.object({
    oauth_token: z.string(),
    oauth_verifier: z.string(),
    userId: z.string(),
  });

  const validationResult = schema.safeParse({ oauth_token, oauth_verifier, userId });

  if (!validationResult.success) {
    console.error('Validation error:', validationResult.error);
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=invalid_parameters`);
  }

  const { oauth_token: validOauthToken, oauth_verifier: validOauthVerifier, userId: validUserId } = validationResult.data;

  if (!validOauthToken || !validOauthVerifier) {
    console.error('Missing OAuth token or verifier:', { validOauthToken, validOauthVerifier });
    return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=missing_oauth_params`);
  }

  const supabase = createClient(
    (c.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('Supabase client initialized');

  try {
    console.log('Exchanging tokens with Twitter');
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    const consumerKey = (c.env as any).TWITTER_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY;
    const consumerSecret = (c.env as any).TWITTER_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET;

    const oauthTimestamp = Math.floor(Date.now() / 1000).toString();
    const oauthNonce = Math.random().toString(36).substring(2);

    const parameters = {
      oauth_consumer_key: consumerKey,
      oauth_token: validOauthToken,
      oauth_verifier: validOauthVerifier,
      oauth_nonce: oauthNonce,
      oauth_timestamp: oauthTimestamp,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_version: '1.0'
    };

    const signatureBaseString = [
      'POST',
      encodeURIComponent(accessTokenUrl),
      encodeURIComponent(Object.entries(parameters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&'))
    ].join('&');

    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(validOauthToken)}`;
    const oauthSignature = createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');

    const authorizationHeader = 'OAuth ' + Object.entries({
      ...parameters,
      oauth_signature: oauthSignature
    })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`)
      .join(', ');

    const accessTokenResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authorizationHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!accessTokenResponse.ok) {
      const errorText = await accessTokenResponse.text();
      console.error('Failed to obtain access token:', accessTokenResponse.status, errorText);
      console.error('Request details:', {
        url: accessTokenUrl,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer [REDACTED]',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=access_token_failure&details=${encodeURIComponent('Twitter API returned an unexpected response. Please try again later.')}`);
    }

    const accessTokenData = new URLSearchParams(await accessTokenResponse.text());
    const accessToken = accessTokenData.get('oauth_token');
    const accessTokenSecret = accessTokenData.get('oauth_token_secret');
    const twitterUserId = accessTokenData.get('user_id');
    const screenName = accessTokenData.get('screen_name');

    if (!accessToken || !accessTokenSecret || !twitterUserId || !screenName) {
      console.error('Missing required data from Twitter');
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=missing_twitter_data`);
    }

    console.log('Checking for existing link');
    const { data: existingLink, error: linkError } = await supabase
      .from('user_linked_accounts')
      .select('user_id')
      .eq('provider', 'twitter')
      .eq('provider_account_id', twitterUserId)
      .maybeSingle();

    if (linkError) {
      console.error('Error checking existing links:', linkError);
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=check_existing_link_failed`);
    }
    
    if (existingLink) {
      console.log('Existing link found:', existingLink);
      if (existingLink.user_id === validUserId) {
        console.log('Account already linked to this user');
        return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/generate?message=already_linked`);
      } else {
        console.log('Account linked to a different user');
        return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=account_linked_to_other_user`);
      }
    }

    console.log('No existing link found, proceeding with linking');

    const linkData = {
      user_id: validUserId,
      provider: 'twitter',
      provider_account_id: twitterUserId,
      access_token: accessToken,
      refresh_token: accessTokenSecret,
      username: screenName,
      expires_at: null,
    };

    console.log('Inserting link data:', linkData);

    const { data, error } = await supabase
      .from('user_linked_accounts')
      .upsert(linkData, {
        onConflict: 'user_id,provider'
      });

    if (error) {
      console.error('Error saving Twitter account to Supabase:', error);
      return c.redirect(`${(c.env as any).CLOUDFLARE_PAGES_URL || process.env.CLOUDFLARE_PAGES_URL}/twitter-linked-error?error=save_account_failed`);
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

  const callbackUrl = `https://realtime-image-gen-api.jhonra121.workers.dev/twitter/auth/callback?userId=${user.id}`;

  const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
  const authorizationUrl = 'https://api.twitter.com/oauth/authorize';

  const oauthTimestamp = Math.floor(Date.now() / 1000).toString();
  const oauthNonce = Math.random().toString(36).substring(2);

  const signatureBaseString = [
    'POST',
    encodeURIComponent(requestTokenUrl),
    encodeURIComponent(`oauth_callback=${encodeURIComponent(callbackUrl)}&oauth_consumer_key=${(c.env as any).TWITTER_CONSUMER_KEY}&oauth_nonce=${oauthNonce}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${oauthTimestamp}&oauth_version=1.0`)
  ].join('&');

  const signingKey = `${encodeURIComponent((c.env as any).TWITTER_CONSUMER_SECRET)}&`;
  const oauthSignature = await createHmacSignature(signingKey, signatureBaseString);

  const authorizationHeader = `OAuth oauth_callback="${encodeURIComponent(callbackUrl)}", oauth_consumer_key="${(c.env as any).TWITTER_CONSUMER_KEY}", oauth_nonce="${oauthNonce}", oauth_signature="${encodeURIComponent(oauthSignature)}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${oauthTimestamp}", oauth_version="1.0"`;

  try {
    const response = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter API Error:', response.status, errorText);
      throw new Error(`Failed to obtain request token: ${response.status} ${errorText}`);
    }

    const data = new URLSearchParams(await response.text());
    const oauthToken = data.get('oauth_token');

    if (!oauthToken) {
      throw new Error('No oauth_token received');
    }

    const authUrl = `${authorizationUrl}?oauth_token=${oauthToken}`;
    return c.json({ authUrl });
  } catch (error) {
    console.error('Error initiating Twitter auth:', error);
    return c.json({ error: 'Failed to initiate Twitter authentication', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function createHmacSignature(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export default app
