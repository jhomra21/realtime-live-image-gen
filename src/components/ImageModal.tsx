import { Show, createSignal, onCleanup, createEffect } from 'solid-js';
import { downloadImage } from '../utils/imageUtils';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { createMutation } from '@tanstack/solid-query';

interface ImageModalProps {
  imageData: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const ImageModal = (props: ImageModalProps) => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isRendered, setIsRendered] = createSignal(false);

  const handleDownload = (e: Event) => {
    e.stopPropagation();
    if (props.imageData) {
      downloadImage(props.imageData);
    }
  };
  

  const uploadMutation = createMutation(() => ({
    mutationFn: async (imageData: string) => {
      // Convert base64 to blob
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

      const uploadResponse = await fetch('http://localhost:3000/api/uploadImage', {
        method: 'POST',
        body: formData,
      });
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }
      return uploadResponse.json();
    },
    onSuccess: async (data) => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('user_images').insert({
          user_id: userData.user.id,
          image_url: data.url,
        });
      }
    },
  }));

  const handleSaveToR2 = async (e: Event) => {
    e.stopPropagation();
    if (props.imageData) {
      try {
        await uploadMutation.mutateAsync(props.imageData);
        console.log("Image uploaded successfully");
      } catch (error) {
        console.error("Error uploading image:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        // You might want to show an error message to the user here
      }
    } else {
      console.error("No image data available");
    }
  };

  const handleOutsideClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const closeModal = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsRendered(false);
      props.onClose();
    }, 300); // Wait for the fade-out transition to complete
  };

  createEffect(() => {
    if (props.isOpen) {
      setIsRendered(true);
      // Use setTimeout to ensure the modal is rendered before setting it to visible
      setTimeout(() => setIsVisible(true), 50);
    }
  });

  return (
    <Show when={isRendered()}>
      <div 
        class={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-200 ease-in-out ${isVisible() ? 'bg-opacity-75 backdrop-blur-sm opacity-100' : 'bg-opacity-0 opacity-0'}`}
        onClick={handleOutsideClick}
      >
        <div class={`relative transition-all duration-200 ease-in-out ${isVisible() ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
          <button
            onClick={closeModal}
            class="absolute -top-10 right-0 text-white text-3xl hover:text-gray-300 transition-colors"
          >
            &times;
          </button>
          <img
            src={`data:image/png;base64,${props.imageData}`}
            alt="Expanded image"
            class="max-w-full max-h-[80vh] object-contain mx-auto"
          />
        </div>
        <div class="mt-4 space-x-4">
          <Button
            onClick={handleDownload}
            class="px-6 py-2 bg-blue-600 bg-opacity-80 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Download
          </Button>
          <Button
            onClick={handleSaveToR2}
            class="px-6 py-2 bg-green-600 bg-opacity-80 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? 'Saving...' : 'Save to R2'}
          </Button>
        </div>
      </div>
    </Show>
  );
};

export default ImageModal;
