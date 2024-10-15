import { Show, createSignal, onCleanup, createEffect } from 'solid-js';

import { Button } from './ui/button';

interface UserImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

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
            src={props.imageUrl}
            alt="User image"
            class="max-w-full max-h-[80vh] object-contain mx-auto"
          />
        </div>
        
      </div>
    </Show>
  );
};
