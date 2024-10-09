import { render } from 'solid-js/web'
import { createSignal, createEffect, Show } from 'solid-js'
import { createQuery, QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { debounce } from '@solid-primitives/scheduled'

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

const AppContent = () => {
  const [prompt, setPrompt] = createSignal('')
  const [userAPIKey, setUserAPIKey] = createSignal('')
  const [error, setError] = createSignal('')
  const [debouncedPrompt, setDebouncedPrompt] = createSignal('')

  // Increase the debounce delay to 800ms
  const debouncedSetPrompt = debounce((value: string) => {
    setDebouncedPrompt(value.trim())
  }, 600)

  // Effect to update the debounced prompt
  createEffect(() => {
    debouncedSetPrompt(prompt())
  })

  const image = createQuery(() => ({
    queryKey: ['image', debouncedPrompt(), userAPIKey()],
    queryFn: async ({ queryKey }) => {
      const [, prompt, apiKey] = queryKey;
      if (!prompt) return null;
      
      const res = await fetch(`${API_BASE_URL}/api/generateImages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userAPIKey: apiKey })
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      return await res.json() as { b64_json: string; timings: { inference: number } }
    },
    enabled: () => debouncedPrompt().length > 0,
    staleTime: Infinity,
  }))

  createEffect(() => {
    if (image.error) {
      setError(image.error.message)
    } else {
      setError('')
    }
  })

  return (
    <div class="flex h-screen flex-col bg-gray-100 p-4">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-4">AI Image Generator</h1>
        <div class="flex flex-col sm:flex-row sm:items-center">
          <label class="text-sm text-gray-600 mr-2">
            [Optional] Together API Key:
          </label>
          <input
            placeholder="Enter your API key"
            type="password"
            value={userAPIKey()}
            class="mt-1 sm:mt-0 p-2 border rounded-md flex-grow max-w-md"
            onInput={(e) => setUserAPIKey(e.currentTarget.value)}
          />
        </div>
      </header>

      <div class="flex-grow flex flex-col items-center justify-start">
        <form class="w-full max-w-2xl mb-4" onSubmit={(e) => e.preventDefault()}>
          <textarea
            rows={4}
            placeholder="Describe the image you want to generate..."
            required
            value={prompt()}
            onInput={(e) => setPrompt(e.currentTarget.value)}
            class="w-full p-2 border rounded-md resize-none"
          />
        </form>

        <Show when={error()}>
          <div class="text-red-500 mb-4">{error()}</div>
        </Show>

        <div class="w-full max-w-2xl aspect-video bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
          <Show when={image.data}>
            <img
              src={`data:image/png;base64,${image.data?.b64_json}`}
              alt="Generated image"
              class={`w-full h-full object-contain ${
                image.isFetching ? 'animate-pulse' : ''
              }`}
            />
          </Show>
          <Show when={image.isLoading && !image.data}>
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-blue-600"></div>
          </Show>
          <Show when={!image.isLoading && !image.data}>
            <p class="text-gray-500">Your image will appear here</p>
          </Show>
        </div>
      </div>

      {/* Debug information */}
      <div class="mt-4 text-sm text-gray-500">
        <p>Current prompt: {prompt()}</p>
        <p>Debounced prompt: {debouncedPrompt()}</p>
        <p>Image loading: {image.isLoading ? 'Yes' : 'No'}</p>
        <p>Image available: {image.data ? 'Yes' : 'No'}</p>
      </div>
    </div>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
)

render(() => <App />, document.getElementById('root')!)