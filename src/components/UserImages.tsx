import { createQuery } from '@tanstack/solid-query';
import { createSignal, For, Show } from 'solid-js';
import { supabase } from '../lib/supabase';
import { z } from 'zod';
import { UserImageModal } from './UserImageModal';
import { useAuth } from '../hooks/useAuth';

const UserImageSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  created_at: z.string().or(z.date()).transform((val) => new Date(val)), // More flexible parsing
});

type UserImage = z.infer<typeof UserImageSchema>;

export function UserImages() {
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = createSignal<string | null>(null);
  const [isModalOpen, setIsModalOpen] = createSignal(false);

  const userImagesQuery = createQuery(() => ({
    queryKey: ['allImages'],
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">Images stored in Cloudflare R2</h2>
      <Show when={!userImagesQuery.isLoading} fallback={<div>Loading...</div>}>
        <Show when={userImagesQuery.data} fallback={<div>No images found.</div>}>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <For each={userImagesQuery.data}>
              {(image: UserImage) => (
                <div class="relative aspect-square">
                  <img
                    src={image.image_url}
                    alt="Generated image"
                    class="w-full h-full object-cover rounded-lg cursor-pointer"
                    onClick={() => {
                      setSelectedImage(image.image_url);
                      setIsModalOpen(true);
                    }}
                  />
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
        />
      </Show>
    </div>
  );
}
