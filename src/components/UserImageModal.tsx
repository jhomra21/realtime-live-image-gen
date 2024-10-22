import { Show, createSignal, createEffect, For } from 'solid-js';


interface UserImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;

}

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

export const UserImageModal = (props: UserImageModalProps) => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isRendered, setIsRendered] = createSignal(false);


  
  const handleOutsideClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };
 const closeModal = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsRendered(false);
      props.onClose(); // Call the onClose prop to inform the parent component
    }, 150); // Wait for the fade-out transition to complete
  };
  createEffect(() => {
    if (props.isOpen) {
      setIsRendered(true);
      // Use setTimeout to ensure the modal is rendered before setting it to visible
      setTimeout(() => setIsVisible(true), 50);
    } else {
      // Reset the modal state when it's closed
      closeModal();
    }
  })
  return (
    <Show when={isRendered()}>
      <div
        class={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-200 ease-in-out ${isVisible() ? 'bg-opacity-75 backdrop-blur-sm opacity-100' : 'bg-opacity-0 opacity-0'}`}
        onClick={handleOutsideClick}
      >
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
          <h2 class="text-2xl font-bold mb-4">Share on Twitter</h2>
          <img src={props.imageUrl} alt="Selected image" class="w-full h-auto mb-4 rounded" />
          
        </div>
      </div>
    </Show>
  );
};
