import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import Together from 'together-ai'
import { Redis } from '@upstash/redis/cloudflare'
import { Ratelimit } from '@upstash/ratelimit'

const app = new Hono()

// Update the CORS configuration
app.use(cors({
  origin: ['https://realtime-live-image-gen.pages.dev', 'http://localhost:3000'],
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))

app.post('/api/generateImages', async (c) => {
  const options: ConstructorParameters<typeof Together>[0] = {
    apiKey: (c.env as any).TOGETHER_API_KEY,
  }
  const redis = new Redis({
    url: (c.env as any).UPSTASH_REDIS_REST_URL,
    token: (c.env as any).UPSTASH_REDIS_REST_TOKEN,
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
  })

  try {
    const body = await c.req.json()
    const { prompt, userAPIKey, iterativeMode } = schema.parse(body)

    if (userAPIKey) {
      client.apiKey = userAPIKey
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
      model: "black-forest-labs/FLUX.1-schnell-Free",
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

export default app