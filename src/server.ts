import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import Together from 'together-ai'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const app = new Hono()

// Simplified CORS middleware
app.use('/*', cors())

let options: ConstructorParameters<typeof Together>[0] = {}
let ratelimit: Ratelimit | undefined

// Configure Together AI client and rate limiting
if (Bun.env.HELICONE_API_KEY) {
  options = {
    baseURL: "https://together.helicone.ai/v1",
    defaultHeaders: {
      "Helicone-Auth": `Bearer ${Bun.env.HELICONE_API_KEY}`,
    }
  }
}

if (Bun.env.UPSTASH_REDIS_REST_URL) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.fixedWindow(100, "1440 m"),
    analytics: true,
    prefix: "blinkshot", // Changed to match the provided snippet
  })
}

const client = new Together(options)

app.post('/api/generateImages', async (c) => {
  const schema = z.object({
    prompt: z.string(),
    userAPIKey: z.string().optional(),
  })

  try {
    const body = await c.req.json()
    const { prompt, userAPIKey } = schema.parse(body)

    if (userAPIKey) {
      client.apiKey = userAPIKey
    }

    if (ratelimit && !userAPIKey) {
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
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
      // @ts-expect-error - this is not typed in the API
      response_format: "base64",
    })

    return c.json(response.data[0])
  } catch (error: any) {
    console.error('Error generating image:', error)
    return c.json({ error: error.message || 'An error occurred while generating the image' }, 500)
  } finally {
    // Reset the API key to the original value if it was changed
    if (options.apiKey) {
      client.apiKey = options.apiKey
    }
  }
})

const port = 3000
console.log(`Server is running on port ${port}`)

export default {
  port,
  fetch: app.fetch
}