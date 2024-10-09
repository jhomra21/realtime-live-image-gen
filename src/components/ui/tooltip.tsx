import { createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

export function Tooltip(props: { content: string; children: any }) {
  const [isVisible, setIsVisible] = createSignal(false);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });

  const showTooltip = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.bottom + window.scrollY });
    setIsVisible(true);
  };

  return (
    <>
      <div
        onMouseEnter={showTooltip}
        onMouseLeave={() => setIsVisible(false)}
      >
        {props.children}
      </div>
      <Show when={isVisible()}>
        <Portal>
          <div
            class="absolute z-50 px-2 py-1 text-sm text-white bg-gray-800 rounded shadow-lg"
            style={{
              top: `${position().y}px`,
              left: `${position().x}px`,
              transform: 'translateY(8px)',
            }}
          >
            {props.content}
          </div>
        </Portal>
      </Show>
    </>
  );
}