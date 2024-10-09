import { render } from 'solid-js/web'
import { createSignal, createEffect, Show } from 'solid-js'
import { createQuery, QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { debounce } from '@solid-primitives/scheduled'
import { downloadImage } from '../utils/imageUtils'

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
  const [isGeneratingNew, setIsGeneratingNew] = createSignal(false)
  const [lastGeneratedImage, setLastGeneratedImage] = createSignal<string | null>(null)
  const [consistencyMode, setConsistencyMode] = createSignal(false)

  // Increase the debounce delay to 800ms
  const debouncedSetPrompt = debounce((value: string) => {
    setDebouncedPrompt(value.trim())
  }, 400)

  // Effect to update the debounced prompt
  createEffect(() => {
    debouncedSetPrompt(prompt())
  })

  const image = createQuery(() => ({
    queryKey: ['image', debouncedPrompt(), userAPIKey(), consistencyMode()],
    queryFn: async ({ queryKey }) => {
      const [, prompt, apiKey, consistency] = queryKey;
      if (!prompt) return null;
      
      setIsGeneratingNew(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/generateImages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, userAPIKey: apiKey, consistencyMode: consistency })
        })
        if (!res.ok) {
          throw new Error(await res.text())
        }
        const data = await res.json() as { b64_json: string; timings: { inference: number } }
        setLastGeneratedImage(data.b64_json)
        return data
      } finally {
        setIsGeneratingNew(false)
      }
    },
    enabled: () => debouncedPrompt().length > 0,
    staleTime: Infinity,
    retry: false,
  }))

  createEffect(() => {
    if (image.error) {
      setError(image.error.message)
    } else {
      setError('')
    }
  })

  const handleDownload = () => {
    const imageData = image.data?.b64_json || lastGeneratedImage()
    if (imageData) {
      downloadImage(imageData)
    }
  }

  return (
    <div class="flex h-screen flex-col bg-gray-100 p-4">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-4">Real-Time AI Image Generator</h1>
        <div class="flex flex-col sm:flex-row sm:items-center mb-4">
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
        <div class="flex items-center">
          <input
            type="checkbox"
            id="consistencyMode"
            checked={consistencyMode()}
            onChange={(e) => setConsistencyMode(e.target.checked)}
            class="mr-2"
          />
          <label for="consistencyMode" class="text-sm text-gray-600">
            Consistency Mode <span class="text-gray-500">(this enables the model to try and maintain consistency across images)</span>
          </label>
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

        <div class="w-full max-w-2xl aspect-video bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative">
          <Show when={lastGeneratedImage() || image.data}>
            <img
              src={`data:image/png;base64,${image.data?.b64_json || lastGeneratedImage()}`}
              alt="Generated image"
              class={`w-full h-full object-contain transition-all duration-300 ${
                isGeneratingNew() ? 'blur-md' : ''
              }`}
            />
          </Show>
          <Show when={isGeneratingNew()}>
            <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
              <div class="animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-blue-600"></div>
            </div>
          </Show>
          <Show when={!lastGeneratedImage() && !image.data && !isGeneratingNew()}>
            <p class="text-gray-500">Your image will appear here</p>
          </Show>
        </div>

        {/* Download button */}
        <Show when={!isGeneratingNew() && (lastGeneratedImage() || image.data)}>
          <button
            onClick={handleDownload}
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Download Image
          </button>
        </Show>
      </div>

      {/* Debug information */}
      <div class="mt-4 text-sm text-gray-500">
        <p>Current prompt: {prompt()}</p>
        <p>Debounced prompt: {debouncedPrompt()}</p>
        <p>Image loading: {isGeneratingNew() ? 'Yes' : 'No'}</p>
        <p>Image available: {(lastGeneratedImage() || image.data) ? 'Yes' : 'No'}</p>
        <p>Consistency Mode: {consistencyMode() ? 'On' : 'Off'}</p>
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