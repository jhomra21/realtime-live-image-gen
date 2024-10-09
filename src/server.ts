import { Hono } from 'hono'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import Together from 'together-ai'
import { cors } from 'hono/cors'

const app = new Hono()

// Add CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your frontend URL
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}))

let options: ConstructorParameters<typeof Together>[0] = {}
let ratelimit: Ratelimit | undefined

// Configure Together AI client and rate limiting
if (Bun.env.HELICONE_API_KEY) {
  options.baseURL = "https://together.helicone.ai/v1"
  options.defaultHeaders = {
    "Helicone-Auth": `Bearer ${Bun.env.HELICONE_API_KEY}`,
  }
}

if (Bun.env.UPSTASH_REDIS_REST_URL) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.fixedWindow(100, "1440 m"),
    analytics: true,
    prefix: "juanRealtime", // Add this line
  })
}

const client = new Together(options)

app.post('/api/generateImages', async (c) => {
  const originalApiKey = client.apiKey // Store the original API key
  try {
    const body = await c.req.json()
    const { prompt, userAPIKey } = z.object({
      prompt: z.string(),
      userAPIKey: z.string().optional(),
    }).parse(body)

    if (userAPIKey) {
      client.apiKey = userAPIKey
    }

    if (ratelimit && !userAPIKey) {
      const identifier = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '0.0.0.0'
      const { success } = await ratelimit.limit(identifier)
      if (!success) {
        return c.json({ error: "No requests left. Please add your own API key or try again in 24h." }, 429)
      }
    }

    const response = await client.images.create({
      prompt,
      model: "black-forest-labs/FLUX.1-schnell-Free",
      width: 1024,
      height: 768,
      steps: 3,
      // @ts-expect-error - this is not typed in the API
      response_format: "base64",
    })

    return c.json(response.data[0])
  } catch (error: any) {
    console.error('Error generating image:', error)
    return c.json({ error: error.message || 'An error occurred while generating the image' }, 500)
  } finally {
    client.apiKey = originalApiKey // Reset the API key to the original value
  }
})

const port = 3000
console.log(`Server is running on port ${port}`)

export default {
  port,
  fetch: app.fetch
}