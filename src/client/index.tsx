import { render } from 'solid-js/web'
import { createSignal, createEffect, Show } from 'solid-js'
import { createQuery, QueryClient, QueryClientProvider } from '@tanstack/solid-query'

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

const queryClient = new QueryClient()

const AppContent = () => {
  const [prompt, setPrompt] = createSignal('')
  const [userAPIKey, setUserAPIKey] = createSignal('')
  const [debouncedPrompt, setDebouncedPrompt] = createSignal('')
  const [error, setError] = createSignal('')

  // Debounce effect (unchanged)
  createEffect(() => {
    const currentPrompt = prompt()
    const timer = setTimeout(() => {
      setDebouncedPrompt(currentPrompt)
      console.log('Debounced prompt:', currentPrompt)
    }, 300)
    return () => clearTimeout(timer)
  })

  const image = createQuery(() => ({
    queryKey: ['image', debouncedPrompt()],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/generateImages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: debouncedPrompt(), userAPIKey: userAPIKey() })
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      return await res.json() as { b64_json: string; timings: { inference: number } }
    },
    enabled: () => !!debouncedPrompt().trim(),
    staleTime: Infinity,
    retry: false,
    placeholderData: (prev) => prev,
  }))

  createEffect(() => {
    if (image.error) {
      setError(image.error.message)
    }
  })

  const isDebouncing = () => prompt() !== debouncedPrompt()

  return (
    <div class="container mx-auto p-4">
      <h1 class="text-3xl font-bold mb-4">Real-Time AI Image Generator</h1>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700">API Key (Optional)</label>
        <input
          type="password"
          value={userAPIKey()}
          onInput={(e) => setUserAPIKey(e.currentTarget.value)}
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          placeholder="Enter your Together AI API key"
        />
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700">Image Prompt</label>
        <textarea
          value={prompt()}
          onInput={(e) => setPrompt(e.currentTarget.value)}
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          placeholder="Describe your image..."
          rows="4"
        />
      </div>
      <Show when={error()}>
        <div class="text-red-500 mb-4">{error()}</div>
      </Show>
      
      {/* Image container with loading and blur effects */}
      <div class="relative w-full h-96 bg-gray-200 rounded-lg overflow-hidden">
        <Show when={image.isLoading || isDebouncing()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </Show>
        <Show when={!image.data && !image.isLoading}>
          <div class="absolute inset-0 flex items-center justify-center text-gray-500">
            Your image will appear here
          </div>
        </Show>
        <Show when={image.data}>
          <img
            src={`data:image/png;base64,${image.data?.b64_json}`}
            alt="Generated image"
            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            classList={{ 'opacity-0 blur-xl': image.isLoading || isDebouncing(), 'opacity-100 blur-0': !image.isLoading && !isDebouncing() }}
          />
        </Show>
      </div>

      {/* Debug information */}
      <div class="mt-4">
        <p>Current prompt: {prompt()}</p>
        <p>Debounced prompt: {debouncedPrompt()}</p>
        <p>Image loading: {image.isLoading ? 'Yes' : 'No'}</p>
        <p>Image available: {image.data ? 'Yes' : 'No'}</p>
      </div>
    </div>
  )
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

render(() => <App />, document.getElementById('root')!)