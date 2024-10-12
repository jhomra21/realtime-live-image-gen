import { createSignal, createEffect, For, Show } from 'solid-js';
import { usePreviousImages } from '../hooks/usePreviousImages';

interface PreviousImagesProps {
  onSelectImage: (imageData: string) => void;
}

const PreviousImages = (props: PreviousImagesProps) => {
  const previousImages = usePreviousImages();

  return (
    <div class="mt-8">
      <Show when={previousImages.data && previousImages.data.length > 0}>
        <h2 class="text-xl sm:text-2xl font-semibold text-blue-300 mb-4">Previously Generated Images</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <For each={previousImages.data}>
            {(imageData) => (
              <div 
                class="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all duration-300"
                onClick={() => props.onSelectImage(imageData)}
              >
                <img 
                  src={`data:image/png;base64,${imageData}`} 
                  alt="Previously generated image" 
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default PreviousImages;
