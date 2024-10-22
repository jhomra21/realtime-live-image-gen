import { createSignal } from 'solid-js';

const INITIAL_COINS = 100;
const STORAGE_KEY = 'userCoins';

export function useUserCoins() {
  const [coins, setCoins] = createSignal(
    parseInt(localStorage.getItem(STORAGE_KEY) || INITIAL_COINS.toString(), 10)
  );

  const subtractCoins = (amount: number) => {
    if (coins() < amount) throw new Error('Insufficient coins');

    const newCoinAmount = coins() - amount;
    setCoins(newCoinAmount);
    localStorage.setItem(STORAGE_KEY, newCoinAmount.toString());
  };

  const hasEnoughCoins = (amount: number) => coins() >= amount;

  return {
    coins,
    subtractCoins,
    hasEnoughCoins,
  };
}
