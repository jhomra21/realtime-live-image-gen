import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import Together from 'together-ai'
import { Redis } from '@upstash/redis/cloudflare'
import { Ratelimit } from '@upstash/ratelimit'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const app = new Hono()

const API_LOCAL_URL = 'http://127.0.0.1:8787'

// Apply CORS middleware to all routes
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://realtime-live-image-gen.pages.dev', 'https://dashboard.stripe.com', 'https://api.stripe.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))



const PRICE_PER_MP = 0.0027;
const DEFAULT_STEPS = {
  'black-forest-labs/FLUX.1-schnell-Free': 2,
  'black-forest-labs/FLUX.1-schnell': 4,
  'black-forest-labs/FLUX.1.1-pro': 50,
  // Add other models as needed
};

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
    width: z.number().default(1024),
    height: z.number().default(768),
    steps: z.number().default(2)
  })

  try {
    const { prompt, userAPIKey, iterativeMode, model, width, height, steps } = schema.parse(await c.req.json())

    // Calculate coin cost
    const numberOfMP = (width * height) / 1000000;
    const defaultSteps = DEFAULT_STEPS[model as keyof typeof DEFAULT_STEPS];
    const coinCost = Math.ceil(numberOfMP * PRICE_PER_MP * (steps / defaultSteps) * 1000); // Multiply by 100 to convert to coins

    // Check if user has enough coins (you'll need to implement this)
    // if (!hasEnoughCoins(coinCost)) {
    //   return c.json({ error: 'Insufficient coins' }, 400);
    // }

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

    // Return the generated image data along with the coin cost
    return c.json({ b64_json: response.data[0].b64_json, timings: { inference: 0 }, coinCost });
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
    const r2PublicDomain = (c.env as any).R2_PUBLIC_DOMAIN_IMAGES || process.env.R2_PUBLIC_DOMAIN_IMAGES;  // Use images domain

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

app.post('/api/create-checkout-session', async (c) => {
  const stripe = new Stripe((c.env as any).STRIPE_SECRET_KEY);
  
  try {
    const body = await c.req.json();
    const { userId, productId } = body;

    if (!userId || !productId) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: productId,
            unit_amount: 999, // $9.99
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${(c.env as any).CLOUDFLARE_PAGES_URL}/coins?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${(c.env as any).CLOUDFLARE_PAGES_URL}/coins`,
      client_reference_id: userId,
    });

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// Add this validation schema
const stripeEventSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      client_reference_id: z.string().optional(),
      amount_total: z.number(),
      payment_status: z.string(),
      status: z.string(),
    }),
  }),
});

app.post('/api/stripe-webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  const webhookSecret = (c.env as any).STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('Missing signature or webhook secret');
    return c.json({ error: 'Missing stripe signature or webhook secret' }, 400);
  }

  try {
    // Get the raw body as an ArrayBuffer
    const rawBody = await c.req.raw.arrayBuffer();
    // Convert ArrayBuffer to string
    const rawBodyString = new TextDecoder().decode(rawBody);

    // Parse the event without verification first
    const event = JSON.parse(rawBodyString);

    // Basic timestamp verification
    const timestampStr = signature.split(',')[0].split('=')[1];
    const timestamp = parseInt(timestampStr);
    const now = Math.floor(Date.now() / 1000);

    // Verify timestamp is not too old (5 minutes tolerance)
    if (now - timestamp > 300) {
      return c.json({ error: 'Webhook timestamp too old' }, 400);
    }

    // Create Supabase client
    const supabase = createClient(
      (c.env as any).VITE_SUPABASE_URL,
      (c.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;

      if (!userId) {
        console.error('No user ID in session');
        return c.json({ error: 'No user ID in session' }, 400);
      }

      try {
        // First, get the current coins value
        const { data: currentAccount, error: fetchError } = await supabase
          .from('accounts')
          .select('coins')
          .eq('user_id', userId)
          .single();

        if (fetchError) {
          console.error('Error fetching current coins:', fetchError);
          return c.json({ error: 'Error fetching account' }, 500);
        }

        // Calculate new coins value (current + 50)
        const newCoins = (currentAccount?.coins || 0) + 50;

        // Update the account with new coins value
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ 
            coins: newCoins,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating coins:', updateError);
          return c.json({ error: 'Error updating coins' }, 500);
        }

        console.log('Successfully updated coins for user:', userId, 'New balance:', newCoins);
        return c.json({ received: true });
      } catch (error: any) {
        console.error('Error processing payment:', error);
        return c.json({ error: 'Error processing payment' }, 500);
      }
    }

    // Return a 200 response for other event types
    return c.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return c.json({ error: `Webhook Error: ${error.message}` }, 400);
  }
});

// Add this after your existing endpoints
app.post('/api/uploadTrainingImages', async (c) => {
  try {
    const formData = await c.req.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return c.json({ error: 'No images provided' }, 400);
    }

    const bucket = (c.env as any).TRAINING_DATA_BUCKET;
    const r2PublicDomain = (c.env as any).R2_PUBLIC_DOMAIN;

    if (!bucket || typeof bucket.put !== 'function') {
      console.error('R2 training bucket not properly configured:', bucket);
      throw new Error('R2 training bucket not properly configured');
    }

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const filename = `training_${Date.now()}_${crypto.randomUUID()}_${file.name}`;
        const arrayBuffer = await file.arrayBuffer();

        await bucket.put(filename, arrayBuffer, {
          httpMetadata: { contentType: file.type },
        });

        return {
          originalName: file.name,
          url: `https://${r2PublicDomain}/${filename}`
        };
      })
    );

    return c.json({ 
      success: true,
      files: uploadResults 
    });
  } catch (error) {
    console.error('Error uploading training images:', error);
    return c.json({ 
      error: 'Failed to upload training images', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Add this new endpoint for zip file upload
app.post('/api/uploadTrainingZip', async (c) => {
  try {
    const formData = await c.req.formData();
    const zipFile = formData.get('zipFile') as File | null;

    if (!zipFile) {
      return c.json({ error: 'No zip file provided' }, 400);
    }

    const bucket = (c.env as any).TRAINING_DATA_BUCKET;
    const r2PublicDomain = (c.env as any).R2_PUBLIC_DOMAIN_TRAINING;  // Use training domain

    if (!bucket || typeof bucket.put !== 'function') {
      console.error('R2 training bucket not properly configured:', bucket);
      throw new Error('R2 training bucket not properly configured');
    }

    // Generate a unique filename for the zip
    const filename = `training_${Date.now()}_${crypto.randomUUID()}.zip`;

    // Read the zip file content
    const arrayBuffer = await zipFile.arrayBuffer();

    // Upload the zip file to R2
    await bucket.put(filename, arrayBuffer, {
      httpMetadata: { 
        contentType: 'application/zip',
        contentDisposition: 'attachment; filename=' + filename
      },
    });

    const publicUrl = `https://${r2PublicDomain}/${filename}`;
    
    return c.json({ 
      success: true,
      url: publicUrl
    });
  } catch (error) {
    console.error('Error uploading training zip:', error);
    return c.json({ 
      error: 'Failed to upload training zip', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default app
