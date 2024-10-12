import { For, Show } from 'solid-js';
import { usePreviousImages } from '../hooks/usePreviousImages';
import { downloadImage } from '../utils/imageUtils';

interface PreviousImagesProps {
  onSelectImage: (imageData: string) => void;
}

const PreviousImages = (props: PreviousImagesProps) => {
  const previousImages = usePreviousImages();

  const handleDownload = (imageData: string, event: Event) => {
    event.stopPropagation();
    downloadImage(imageData);
  };

  return (
    <div class="mt-8 r">
      <Show when={previousImages.data && previousImages.data.length > 0}>
        <div class="relative overflow-hidden rounded-lg">
          <div class="absolute inset-0 bg-blue-600 opacity-75 blur-xl"></div>
          <div class="relative bg-gray-900 bg-opacity-80 backdrop-blur-md p-6 shadow-lg">
            {/* Corner decorations */}
            <div class="absolute rounded-tl-lg top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400"></div>
            <div class="absolute rounded-tr-lg top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400"></div>
            <div class="absolute rounded-bl-lg bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400"></div>
            <div class="absolute rounded-br-lg bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400"></div>
            
            <h2 class="text-xl sm:text-2xl font-semibold text-blue-300 mb-6 text-center">Previously Generated Images</h2>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <For each={previousImages.data}>
                {(image) => (
                  <div 
                    class="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all duration-300 relative group"
                    onClick={() => props.onSelectImage(image.data)}
                  >
                    <img 
                      src={`data:image/png;base64,${image.data}`} 
                      alt={`Generated image ${image.id}`} 
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div 
                      class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                      onClick={(e) => handleDownload(image.data, e)}
                    >
                      <svg 
                        class="w-8 h-8 text-white hover:text-blue-300 transition-colors duration-300"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          stroke-linecap="round" 
                          stroke-linejoin="round" 
                          stroke-width="2" 
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default PreviousImages;
