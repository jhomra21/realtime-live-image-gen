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
  const [apiKeyError, setApiKeyError] = createSignal('')
  const [error, setError] = createSignal('')
  const [debouncedPrompt, setDebouncedPrompt] = createSignal('')
  const [isGeneratingNew, setIsGeneratingNew] = createSignal(false)
  const [lastGeneratedImage, setLastGeneratedImage] = createSignal<string | null>(null)
  const [consistencyMode, setConsistencyMode] = createSignal(false)
  const [showDebug, setShowDebug] = createSignal(false)
  const [showPremadePrompts, setShowPremadePrompts] = createSignal(false)
  const [showAPIKeyModal, setShowAPIKeyModal] = createSignal(false)

  const premadePrompts = [
    "A serene landscape with a misty mountain lake at sunrise",
    "A futuristic cityscape with flying cars and neon lights",
    "A whimsical forest scene with magical creatures and glowing plants"
  ]

  const handlePremadePromptClick = (selectedPrompt: string) => {
    setPrompt(selectedPrompt)
    setShowPremadePrompts(false)
  }

  const debouncedSetPrompt = debounce((value: string) => {
    setDebouncedPrompt(value.trim())
  }, 400)

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

  const validateAPIKey = (key: string) => {
    // This is a basic validation. Adjust according to the actual format of Together AI API keys
    const apiKeyRegex = /^[a-zA-Z0-9]{64}$/;
    if (!key) {
      setApiKeyError('API key is required');
      return false;
    }
    if (!apiKeyRegex.test(key)) {
      setApiKeyError('Invalid API key format');
      return false;
    }
    setApiKeyError('');
    return true;
  }

  const handleAPIKeySubmit = () => {
    if (validateAPIKey(userAPIKey())) {
      setShowAPIKeyModal(false);
    }
  }

  const handleOutsideClick = (e: MouseEvent) => {
    const modalContent = (e.target as HTMLElement).closest('.modal-content');
    if (!modalContent) {
      setShowAPIKeyModal(false);
    }
  }

  return (
    <div class="flex min-h-screen flex-col bg-gray-900 text-gray-100 p-4 sm:p-6">
      <header class="mb-8">
        <h1 class="text-4xl font-bold text-blue-300 mb-6">Real-Time AI Image Generator</h1>
        <button
          onClick={() => setShowAPIKeyModal(true)}
          class="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Enter API Key
        </button>
        <div class="flex items-center">
          <input
            type="checkbox"
            id="consistencyMode"
            checked={consistencyMode()}
            onChange={(e) => setConsistencyMode(e.target.checked)}
            class="mr-2"
          />
          <label for="consistencyMode" class="text-sm text-gray-300">
            Consistency Mode <span class="text-gray-400">(maintains consistency across images)</span>
          </label>
        </div>
      </header>

      {/* API Key Modal */}
      <Show when={showAPIKeyModal()}>
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleOutsideClick}
        >
          <div class="modal-content bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 class="text-xl font-semibold text-gray-100 mb-4">Enter Your API Key</h2>
            <input
              placeholder="Enter your API key"
              type="password"
              value={userAPIKey()}
              class="w-full p-2 mb-2 border border-gray-700 rounded-md bg-gray-700 text-white"
              onInput={(e) => {
                setUserAPIKey(e.currentTarget.value);
                validateAPIKey(e.currentTarget.value);
              }}
            />
            <Show when={apiKeyError()}>
              <p class="text-red-400 text-sm mb-4">{apiKeyError()}</p>
            </Show>
            <div class="flex justify-end">
              <button
                onClick={handleAPIKeySubmit}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!!apiKeyError()}
              >
                Save
              </button>
              <button
                onClick={() => setShowAPIKeyModal(false)}
                class="ml-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>

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
          <div class="w-full max-w-2xl grid grid-cols-1 gap-4 mb-6">
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

        <div class="w-full max-w-2xl aspect-video bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center relative border-2 border-gray-700 mx-4 sm:mx-0 mt-4">
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