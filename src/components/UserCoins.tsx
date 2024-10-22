import { Badge } from './ui/badge';
import { createSignal, createEffect } from 'solid-js';

interface UserCoinsProps {
  coins: number;
}

export function UserCoins(props: UserCoinsProps) {
  const [highlight, setHighlight] = createSignal(false);
  const [prevCoins, setPrevCoins] = createSignal(props.coins);

  createEffect(() => {
    if (props.coins < prevCoins()) {
      setHighlight(true);
      setTimeout(() => setHighlight(false), 1000);
    }
    setPrevCoins(props.coins);
  });

  return (
    <Badge 
      variant="secondary" 
      class={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-all duration-200 ${
        highlight() ? 'outline outline-2 outline-green-500' : 'outline-none'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 mr-1.5 text-yellow-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1"
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08 .402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span class="font-semibold">{props.coins}</span>
      <span class="ml-1 text-gray-400">Coins</span>
    </Badge>
  );
}

export default UserCoins;
