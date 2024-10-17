import { createSignal, createEffect, Show, For } from 'solid-js';

interface ToastProps {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}

const [toasts, setToasts] = createSignal<ToastProps[]>([]);

export function toast(props: ToastProps) {
  setToasts((prev) => [...prev, props]);
}

export function ToastContainer() {
  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <For each={toasts()}>
        {(toast, index) => (
          <Toast
            {...toast}
            onClose={() => {
              setToasts((prev) => prev.filter((_, i) => i !== index()));
            }}
          />
        )}
      </For>
    </div>
  );
}

function Toast(props: ToastProps & { onClose: () => void }) {
  let timeoutId: number;
  createEffect(() => {
    timeoutId = window.setTimeout(() => {
      props.onClose();
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  });


  return (
    <div
      class={`rounded-md p-4 shadow-md ${
        props.variant === 'destructive' ? 'bg-red-600 text-white' : 'bg-white text-gray-900'
      }`}
    >
      <div class="flex justify-between items-center">
        <h3 class="font-semibold">{props.title}</h3>
        <button onClick={props.onClose} class="text-sm">
          ×
        </button>
      </div>
      <p class="text-sm mt-1">{props.description}</p>
    </div>
  );
}
