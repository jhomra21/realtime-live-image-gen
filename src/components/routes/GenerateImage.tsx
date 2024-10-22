import { createSignal, createEffect, Show, onMount } from 'solid-js'
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query'
import { debounce } from '@solid-primitives/scheduled'
import { Tooltip } from '@/components/ui/tooltip'
import { UserImages } from '@/components/UserImages'
import PreviousImages from '@/components/PreviousImages'
import { usePreviousImages, saveImage } from '@/hooks/usePreviousImages'
import ImageModal, { normalizeUrl } from '@/components/ImageModal'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import { useAuth } from '@/hooks/useAuth'
import { UserImageModal } from '@/components/UserImageModal'
import { supabase } from '@/lib/supabase'
import { APIKeyDialog } from '@/components/APIKeyDialog'
import { useSearchParams } from '@solidjs/router';

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';


const GenerateImage = () => {
  const { user } = useAuth();
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
  const [modelName, setModelName] = createSignal('black-forest-labs/FLUX.1-schnell-Free')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = createSignal(false)
  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [uploadedImageUrl, setUploadedImageUrl] = createSignal<string | null>(null)
  const [isUserImageModalOpen, setIsUserImageModalOpen] = createSignal(false)
  const [isTwitterLinked, setIsTwitterLinked] = createSignal(false);
  const [linkedAccounts, setLinkedAccounts] = createSignal<Array<{ username: string }>>([])
  const [searchParams] = useSearchParams();

  const queryClient = useQueryClient()

  const twitterLinkQuery = createQuery(() => ({
    queryKey: ['twitterLink', (user() as any)?.id],
    queryFn: async () => {
      const currentUser = user();
      if (!currentUser) return { linked: false, usernames: [] };
      try {
        const { data, error } = await supabase
          .from('user_linked_accounts')
          .select('provider, username')
          .eq('user_id', (currentUser as any).id)
          .eq('provider', 'twitter');

        if (error) {
          console.error('Error fetching Twitter links:', error);
          return { linked: false, usernames: [] };
        }

        const usernames = data?.map(account => account.username) || [];
        return { linked: usernames.length > 0, usernames };
      } catch (error) {
        console.error('Error fetching Twitter links:', error);
        return { linked: false, usernames: [] };
      }
    },
    enabled: !!user(),
  }));

  onMount(() => {
    if (user()) {
      twitterLinkQuery.refetch();
    }
  });

  createEffect(() => {
    if (twitterLinkQuery.data !== undefined) {
      setIsTwitterLinked(twitterLinkQuery.data.linked);
      // If you need to do something with the usernames:
      // const usernames = twitterLinkQuery.data.usernames;
    }
  });

  

  const premadePrompts = [
    "A serene landscape with a misty mountain lake at sunrise",
    "A futuristic cityscape with flying cars and neon lights",
    "A whimsical forest scene with magical creatures and glowing plants"
  ]

  const handlePremadePromptSelect = (event: Event) => {
    const select = event.target as HTMLSelectElement;
    setPrompt(select.value);
  };

  const debouncedSetPrompt = debounce((value: string) => {
    setDebouncedPrompt(value.trim())
  }, 400)

  createEffect(() => {
    debouncedSetPrompt(prompt())
  })

  const handleModelChange = (model: string) => {
    if (userAPIKey()) {
      setModelName(model);
      setIsModelDropdownOpen(false);
    }
  };

  const image = createQuery(() => ({
    queryKey: ['image', debouncedPrompt(), userAPIKey(), consistencyMode(), modelName()],
    queryFn: async ({ queryKey }) => {
      const [, prompt, apiKey, consistency, model] = queryKey;
      if (!prompt) return null;

      setIsGeneratingNew(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/generateImages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, userAPIKey: apiKey, consistencyMode: consistency, model })
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

  const handleAPIKeySubmit = (apiKey: string) => {
    setUserAPIKey(apiKey);
    // If the API key is removed, reset the model to schnell-Free
    if (!apiKey) {
      setModelName('black-forest-labs/FLUX.1-schnell-Free');
    }
  };

  // Add a new effect to watch for changes in the userAPIKey
  createEffect(() => {
    if (!userAPIKey()) {
      setModelName('black-forest-labs/FLUX.1-schnell-Free');
    }
  });

  const handleOutsideClick = (e: MouseEvent) => {
    const modalContent = (e.target as HTMLElement).closest('.modal-content');
    if (!modalContent) {
      setShowAPIKeyModal(false);
    }
  }

  const previousImages = usePreviousImages();

  const uploadImageMutation = createMutation(() => ({
    mutationFn: async (imageData: string) => {
      const base64Data = imageData.split(',')[1] || imageData;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('image', blob, 'image.png');

      const uploadResponse = await fetch(`${API_BASE_URL}/api/uploadImage`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image')
      }

      const { url } = await uploadResponse.json()
      return url
    },
    onSuccess: async (url) => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const normalizedUrl = normalizeUrl(url);
        await supabase.from('user_images').insert({
          user_id: userData.user.id,
          image_url: normalizedUrl,
        });
      }
      setUploadedImageUrl(url)
    },
    onError: (error) => {
      console.error('Error uploading image:', error)
      // Handle error (e.g., show an error message to the user)
    },
  }))

  const handleSaveToR2 = () => {
    const imageData = image.data?.b64_json || lastGeneratedImage()
    if (imageData) {
      uploadImageMutation.mutate(`data:image/png;base64,${imageData}`)
    }
  }

  createEffect(() => {
    const newImage = image.data?.b64_json || lastGeneratedImage()
    if (newImage) {
      saveImage(newImage)
      previousImages.refetch()
    }
  })

  const handleSelectPreviousImage = (imageData: string) => {
    setLastGeneratedImage(imageData);
  };

  const handleImageClick = () => {
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div class="flex-grow flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto">
      <div class="w-full max-w-4xl mb-16"> {/* Added mb-16 for extra space at the bottom */}
        {/* Title section */}
        <div class="relative overflow-hidden rounded-lg mb-6">
          <div class="absolute inset-0 bg-blue-600 opacity-75 blur-xl"></div>
          <div class="relative bg-gray-900 bg-opacity-80 backdrop-blur-md p-6 shadow-lg">
            <div class="absolute rounded-tl-lg top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400"></div>
            <div class="absolute rounded-tr-lg top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400"></div>
            <div class="absolute rounded-bl-lg bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400"></div>
            <div class="absolute rounded-br-lg bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400"></div>

            <h1 class="text-3xl sm:text-4xl font-bold text-white text-center">Real-Time FLUX Image Generator</h1>
          </div>
        </div>

        <Accordion collapsible class="w-full my-6">
          <AccordionItem value="item-1">
            <AccordionTrigger>More Options</AccordionTrigger>
            <AccordionContent>
              <div class="flex items-center mb-2">
                <Tooltip content="API key is optional. Enter your key for higher quality results and faster generation.">
                  {/* Replace the existing API Key Modal with the new component */}
                  <APIKeyDialog
                    isOpen={showAPIKeyModal()}
                    onClose={() => setShowAPIKeyModal(false)}
                    onSubmit={handleAPIKeySubmit}
                    initialApiKey={userAPIKey()}
                  />

                  {/* Make sure the "Enter API Key" button is correctly wired up */}
                  <Button
                    onClick={() => setShowAPIKeyModal(true)}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Enter API Key
                  </Button>
                </Tooltip>
                <span class="ml-2 text-sm text-gray-400">(Optional)</span>
              </div>
              <p class="text-sm text-gray-400 mb-4">You can use the generator without an API key, but entering one will provide better results.</p>
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
            </AccordionContent>
          </AccordionItem>


        </Accordion>

        {/* API Key and Consistency Mode section */}
        <div class="mb-4">


        </div>

        {/* Prompt section */}
        <div class="mb-4">
          <div class="flex justify-between items-center mb-2">
            <h2 class="text-xl sm:text-2xl font-semibold text-blue-300">Enter Your Prompt</h2>
            <div class="relative">
              <div
                class={`relative bg-gray-800 bg-opacity-80 backdrop-blur-sm p-2 rounded-lg shadow-md ${userAPIKey() ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                onClick={() => userAPIKey() && setIsModelDropdownOpen(!isModelDropdownOpen())}
              >
                <div class="absolute inset-0 bg-blue-600 opacity-50 blur-md rounded-lg"></div>
                {/* Corner highlights */}
                <div class="absolute rounded-tl-sm top-0 left-0 w-2 h-2 border-t border-l border-blue-400"></div>
                <div class="absolute rounded-tr-sm top-0 right-0 w-2 h-2 border-t border-r border-blue-400"></div>
                <div class="absolute rounded-bl-sm bottom-0 left-0 w-2 h-2 border-b border-l border-blue-400"></div>
                <div class="absolute rounded-br-sm bottom-0 right-0 w-2 h-2 border-b border-r border-blue-400"></div>

                <div class="relative flex justify-between items-center">
                  <div class="text-sm">
                    Model: <span class="text-blue-300 font-semibold">{modelName().split('/')[1]}</span>
                  </div>
                  <Show when={userAPIKey()}>
                    <svg class="w-4 h-4 text-blue-300 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </Show>
                </div>
              </div>

              <Show when={isModelDropdownOpen() && userAPIKey()}>
                <div class="absolute top-full right-0 mt-1 bg-gray-800 rounded-lg shadow-lg z-10">
                  <div
                    class="p-2 hover:bg-gray-700 cursor-pointer"
                    onClick={() => handleModelChange('black-forest-labs/FLUX.1-schnell-Free')}
                  >
                    Flux Schnell Free
                  </div>
                  <div
                    class="p-2 hover:bg-gray-700 cursor-pointer"
                    onClick={() => handleModelChange('black-forest-labs/FLUX.1-schnell')}
                  >
                    Flux Schnell
                  </div>
                </div>
              </Show>
            </div>
          </div>

          <form class="w-full mb-4" onSubmit={(e) => e.preventDefault()}>
            <textarea
              rows={4}
              placeholder="Describe the image you want to generate..."
              required
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              class="w-full p-2 border border-gray-700 rounded-md resize-none transition-all duration-300 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 bg-gray-800 text-white mb-4"
            />

            <select
              value={prompt()}
              onChange={handlePremadePromptSelect}
              class="w-full p-2 border border-gray-700 rounded-md bg-gray-800 text-white"
            >
              <option value="" disabled>Select a premade prompt</option>
              {premadePrompts.map((premadePrompt) => (
                <option value={premadePrompt}>
                  {premadePrompt}
                </option>
              ))}
            </select>
          </form>
        </div>

        {/* Error message */}
        <Show when={error()}>
          <div class="text-red-400 mb-4">{error()}</div>
        </Show>

        {/* Image display section */}
        <div class="w-full aspect-video bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center relative border-2 border-gray-700 mb-4">
          <Show when={lastGeneratedImage() || image.data}>
            <img
              src={`data:image/png;base64,${image.data?.b64_json || lastGeneratedImage()}`}
              alt="Generated image"
              class={`w-full h-full object-contain transition-all duration-300 ${isGeneratingNew() ? 'blur-md' : ''
                } cursor-pointer`}
              onClick={handleImageClick}
            />
            {/* Add Save to R2 button */}
            <Button
              onClick={handleSaveToR2}
              class="absolute bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              disabled={uploadImageMutation.isPending}
            >
              {uploadImageMutation.isPending ? 'Saving...' : 'Save to R2'}
            </Button>
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

        {/* Previous Images Component */}
        <PreviousImages onSelectImage={handleSelectPreviousImage} />
        {/* this component is for logged in users only. no one else should see it */}
        <Show when={user()}>
          <UserImages />
        </Show>

        {/* Image Modal for the main generated image */}
        <ImageModal
          imageData={image.data?.b64_json || lastGeneratedImage()}
          isOpen={isModalOpen()}
          onClose={handleCloseModal}
        />

        {/* Add UserImageModal */}
        <UserImageModal
          imageUrl={uploadedImageUrl() || ''}
          isOpen={isUserImageModalOpen()}
          onClose={() => setIsUserImageModalOpen(false)}
        />

        {/* Debug section */}
        <div class="flex flex-col items-center mt-8">
          <Button
            onClick={() => setShowDebug(!showDebug())}
            class="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors shadow-md"
          >
            {showDebug() ? 'Hide' : 'Show'} Debug Info
          </Button>

          <Show when={showDebug()}>
            <div class="mt-4 text-sm text-gray-400 bg-gray-800 p-4 rounded-lg shadow-md w-full">
              <p><span class="font-semibold">Current prompt:</span> {prompt()}</p>
              <p><span class="font-semibold">Debounced prompt:</span> {debouncedPrompt()}</p>
              <p><span class="font-semibold">Image loading:</span> {isGeneratingNew() ? 'Yes' : 'No'}</p>
              <p><span class="font-semibold">Image available:</span> {(lastGeneratedImage() || image.data) ? 'Yes' : 'No'}</p>
              <p><span class="font-semibold">Consistency Mode:</span> {consistencyMode() ? 'On' : 'Off'}</p>
            </div>
          </Show>
        </div>
      </div>


    </div>
  )
}

export default GenerateImage;
