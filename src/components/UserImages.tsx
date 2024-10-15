import { createQuery } from '@tanstack/solid-query';
import { createSignal, For, Show } from 'solid-js';
import { supabase } from '../lib/supabase';
import { z } from 'zod';
import ImageModal from './ImageModal';

const UserImageSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  created_at: z.string().datetime(),
});

type UserImage = z.infer<typeof UserImageSchema>;

export function UserImages() {
  const [selectedImage, setSelectedImage] = createSignal<string | null>(null);
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const userImagesQuery = createQuery(() => ({
    queryKey: ['userImages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return z.array(UserImageSchema).parse(data);
    },
  }));

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">Your Generated Images</h2>
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
                    onClick={() => setSelectedImage(image.image_url)}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={selectedImage()}>
        <ImageModal
          imageData={selectedImage()!}
          isOpen={isModalOpen()}
          onClose={handleCloseModal}
        />
      </Show>
    </div>
  );
}
