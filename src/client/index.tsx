import { render } from 'solid-js/web'
import { createSignal, createEffect, Show, For } from 'solid-js'
import { createQuery, QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { debounce } from '@solid-primitives/scheduled'
import { downloadImage } from '../utils/imageUtils'
import '../app.css'  // Import the app.css file

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://localhost:3000';

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
  const [showDebug, setShowDebug] = createSignal(false)
  const [showPremadePrompts, setShowPremadePrompts] = createSignal(false)  // Changed default to false

  const premadePrompts = [
    "A serene landscape with a misty mountain lake at sunrise",
    "A futuristic cityscape with flying cars and neon lights",
    "A whimsical forest scene with magical creatures and glowing plants"
  ]

  const handlePremadePromptClick = (selectedPrompt: string) => {
    setPrompt(selectedPrompt)
    setShowPremadePrompts(false)
  }

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
    <div class="flex min-h-screen flex-col bg-gray-900 text-gray-100 p-4 sm:p-6">
      <header class="mb-8">
        <h1 class="text-4xl font-bold text-blue-300 mb-6">Real-Time AI Image Generator</h1>
        <div class="flex flex-col sm:flex-row sm:items-center mb-6 p-4 bg-gray-800 rounded-lg">
          <label class="text-sm text-gray-300 mr-2">
            [Optional] Together API Key:
          </label>
          <input
            placeholder="Enter your API key"
            type="password"
            value={userAPIKey()}
            class="mt-1 sm:mt-0 p-2 border border-gray-700 rounded-md flex-grow max-w-md bg-gray-700 text-white"
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
          <label for="consistencyMode" class="text-sm text-gray-300">
            Consistency Mode <span class="text-gray-400">(this enables the model to try and maintain consistency across images)</span>
          </label>
        </div>
      </header>

      <div class="flex-grow flex flex-col items-center justify-start">
        <h2 class="text-2xl font-semibold text-blue-300 mb-3">Enter Your Prompt</h2>
        <form class="w-full max-w-2xl mb-6 px-4 sm:px-0" onSubmit={(e) => e.preventDefault()}>
          <textarea
            rows={4}
            placeholder="Describe the image you want to generate..."
            required
            value={prompt()}
            onInput={(e) => setPrompt(e.currentTarget.value)}
            class="w-full p-2 border border-gray-700 rounded-md resize-none transition-all duration-300 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 bg-gray-800 text-white"
          />
        </form>

        {/* Add the toggle button for premade prompts */}
        <button
          onClick={() => setShowPremadePrompts(!showPremadePrompts())}
          class="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showPremadePrompts() ? 'Hide' : 'Show'} Premade Prompts
        </button>

        <Show when={error()}>
          <div class="text-red-400 mb-4">{error()}</div>
        </Show>

        <Show when={showPremadePrompts() && !isGeneratingNew()}>
          <div class="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <For each={premadePrompts}>
              {(premadePrompt) => (
                <button
                  onClick={() => handlePremadePromptClick(premadePrompt)}
                  class="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left h-full"
                >
                  {premadePrompt}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="w-full max-w-2xl aspect-video bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center relative border-2 border-gray-700 mx-4 sm:mx-0">
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
            <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
              <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-300 border-t-blue-600"></div>
            </div>
          </Show>
          <Show when={!lastGeneratedImage() && !image.data && !isGeneratingNew()}>
            <p class="text-gray-400">Your image will appear here</p>
          </Show>
        </div>

        <Show when={!isGeneratingNew() && (lastGeneratedImage() || image.data)}>
          <button
            onClick={handleDownload}
            class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Download Image
          </button>
        </Show>
      </div>

      <button
        onClick={() => setShowDebug(!showDebug())}
        class="mt-4 text-sm text-gray-400 hover:text-gray-300"
      >
        {showDebug() ? 'Hide' : 'Show'} Debug Info
      </button>

      <Show when={showDebug()}>
        <div class="mt-4 text-sm text-gray-400">
          <p>Current prompt: {prompt()}</p>
          <p>Debounced prompt: {debouncedPrompt()}</p>
          <p>Image loading: {isGeneratingNew() ? 'Yes' : 'No'}</p>
          <p>Image available: {(lastGeneratedImage() || image.data) ? 'Yes' : 'No'}</p>
          <p>Consistency Mode: {consistencyMode() ? 'On' : 'Off'}</p>
        </div>
      </Show>
    </div>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
)

render(() => <App />, document.getElementById('root')!)