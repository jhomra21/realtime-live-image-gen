import { createQuery } from '@tanstack/solid-query';
import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
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
  const [userImages, setUserImages] = createSignal<UserImage[]>([]);

  const fetchUserImages = async () => {
    const { data, error } = await supabase
      .from('user_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error);
      return [];
    }

    const parsedData = z.array(UserImageSchema).safeParse(data);
    if (!parsedData.success) {
      console.error('Zod parsing error:', parsedData.error);
      return [];
    }

    return parsedData.data;
  };

  const userImagesQuery = createQuery(() => ({
    queryKey: ['userImages'],
    queryFn: fetchUserImages,
    onSuccess: (data: UserImage[]) => setUserImages(data),
  }));

  createEffect(() => {
    const subscription = supabase
      .channel('user_images_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_images' }, 
        async (payload) => {
          console.log('Change received!', payload);
          // Refetch the images when there's a change
          const updatedImages = await fetchUserImages();
          setUserImages(updatedImages);
        }
      )
      .subscribe();

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">Images stored in Cloudflare R2</h2>
      <Show when={!userImagesQuery.isLoading} fallback={<div>Loading...</div>}>
        <Show when={userImages().length > 0} fallback={<div>No images found.</div>}>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <For each={userImages()}>
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
