import { Badge } from './ui/badge';
import { createSignal, createEffect } from 'solid-js';

interface UserCoinsProps {
    coins: number;
}

export function UserCoins(props: UserCoinsProps) {
    const [displayedCoins, setDisplayedCoins] = createSignal(props.coins);
    const [highlight, setHighlight] = createSignal(false);
    const [prevCoins, setPrevCoins] = createSignal(props.coins);

    createEffect(() => {


        if (props.coins !== prevCoins()) {
            // Highlight effect
            setHighlight(true);
            setTimeout(() => setHighlight(false), 1000);

            // Animate the number change
            const start = prevCoins();
            const end = props.coins;
            const duration = 600; // Animation duration in ms
            const startTime = performance.now();

            const animateValue = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function for smooth animation
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const current = Math.round(start + (end - start) * easeOutQuart);

                setDisplayedCoins(current);

                if (progress < 1) {
                    requestAnimationFrame(animateValue);
                }
            };
            requestAnimationFrame(animateValue);
            setPrevCoins(props.coins);
        }
    });

    return (
        <div>
            <Badge
                variant="secondary"
                class={`h-full inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-all duration-200 ${
                    highlight() ? 'outline outline-2 outline-green-500' : 'outline-none'
                }`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-1.5 text-yellow-400 flex-shrink-0"
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
                <div class="flex items-baseline">
                    <span class="text-2xl font-bold tabular-nums transition-all duration-200">
                        {displayedCoins()}
                    </span>
                    <span class="text-base ml-1 text-gray-400">Coins</span>
                </div>
            </Badge>
        </div>
    );
}

export default UserCoins;
