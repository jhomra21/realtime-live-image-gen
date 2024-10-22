import { createQuery } from '@tanstack/solid-query';
import { createSignal, For, Show, onCleanup } from 'solid-js';
import { supabase } from '../lib/supabase';
import { z } from 'zod';
import { UserImageModal } from './UserImageModal';
import { useQueryClient } from '@tanstack/solid-query';

const UserImageSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  created_at: z.string().or(z.date()).transform((val) => new Date(val)), // More flexible parsing
});

type UserImage = z.infer<typeof UserImageSchema>;

export function UserImages() {

  const [selectedImage, setSelectedImage] = createSignal<string | null>(null);
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [selectedImageCreatedAt, setSelectedImageCreatedAt] = createSignal<Date | null>(null);
  const queryClient = useQueryClient();


  const userImagesQuery = createQuery(() => ({
    queryKey: ['userImages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Raw data from Supabase:', data); // Keep this log

      const parsedData = z.array(UserImageSchema).safeParse(data);
      if (!parsedData.success) {
        console.error('Zod parsing error:', parsedData.error);
        throw new Error('Failed to parse data');
      }

      return parsedData.data;
    },
  }));

  // Set up real-time subscription
  const subscription = supabase
    .channel('user_images_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'user_images' },
      (payload) => {
        console.log('Change received!', payload);
        queryClient.invalidateQueries({ queryKey: ['userImages'] });
      }
    )
    .subscribe();

  // Clean up subscription when component unmounts
  onCleanup(() => {
    subscription.unsubscribe();
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">Account saved images</h2>
      <Show when={!userImagesQuery.isLoading} fallback={<div>Loading...</div>}>
        <Show when={userImagesQuery.data} fallback={<div>No images found.</div>}>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <For each={userImagesQuery.data}>
              {(image: UserImage) => (
                <div 
                  class="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all duration-300 relative group"
                  onClick={() => {
                    setSelectedImage(image.image_url);
                    setSelectedImageCreatedAt(image.created_at);
                    setIsModalOpen(true);
                  }}
                >
                  <img
                    src={image.image_url}
                    alt="Generated image"
                    class="w-full h-full object-cover rounded-lg"
                  />
                  <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                    <svg 
                      class="w-8 h-8 text-white"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        stroke-linecap="round" 
                        stroke-linejoin="round" 
                        stroke-width="2" 
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path 
                        stroke-linecap="round" 
                        stroke-linejoin="round" 
                        stroke-width="2" 
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                    {image.created_at.toLocaleString()}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={selectedImage() && isModalOpen()}>
        <UserImageModal
          imageUrl={selectedImage()!}
          isOpen={isModalOpen()}
          onClose={handleCloseModal}
          createdAt={selectedImageCreatedAt()}
        />
      </Show>

    </div>
  );
}
