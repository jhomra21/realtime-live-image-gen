import { createSignal } from 'solid-js';

const INITIAL_COINS = 5;
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

  const addCoins = (amount: number) => {
    const newCoinAmount = coins() + amount;
    setCoins(newCoinAmount);
    localStorage.setItem(STORAGE_KEY, newCoinAmount.toString());
  };

  //   hardcoded to 4 coins for now
  const hasEnoughCoins = () => coins() >= 4;

  return {
    coins,
    subtractCoins,
    addCoins,
    hasEnoughCoins,
  };
}
