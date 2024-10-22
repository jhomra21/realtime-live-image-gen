import { createSignal, createEffect, Show, For } from 'solid-js';

interface ToastProps {
  title: string;
  description: string;
  variant?: 'default' | 'destructive' | 'success';
}

const [toasts, setToasts] = createSignal<(ToastProps & { id: string; isExiting?: boolean })[]>([]);

export function toast(props: ToastProps) {
  const id = Math.random().toString(36).substr(2, 9);
  setToasts((prev) => [...prev, { ...props, id }]);
}

export function ToastContainer() {
  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div 
            class={`transition-all duration-300 ${
              toast.isExiting 
                ? 'animate-slide-out-right' 
                : 'animate-slide-in-right'
            }`}
          >
            <Toast
              {...toast}
              onClose={() => {
                // Mark the toast as exiting
                setToasts(prev => 
                  prev.map(t => 
                    t.id === toast.id 
                      ? { ...t, isExiting: true } 
                      : t
                  )
                );
                
                // Remove the toast after animation completes
                setTimeout(() => {
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }, 300); // Match the animation duration
              }}
            />
          </div>
        )}
      </For>
    </div>
  );
}

function Toast(props: ToastProps & { onClose: () => void; id: string }) {
  let timeoutId: number;
  createEffect(() => {
    timeoutId = window.setTimeout(() => {
      props.onClose();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  });

  const getVariantStyles = () => {
    switch (props.variant) {
      case 'destructive':
        return 'bg-gray-800 border-red-600 text-red-500';
      case 'success':
        return 'bg-gray-800 border-green-600 text-green-500';
      default:
        return 'bg-gray-800 border-blue-600 text-blue-500';
    }
  };

  return (
    <div
      class={`rounded-md p-4 shadow-md border backdrop-blur-sm ${getVariantStyles()}`}
    >
      <div class="flex justify-between items-center">
        <h3 class="font-semibold">{props.title}</h3>
        <button 
          onClick={props.onClose} 
          class="text-sm hover:text-white transition-colors"
        >
          ×
        </button>
      </div>
      <p class="text-sm mt-1 text-gray-300">{props.description}</p>
    </div>
  );
}
