import { Show, createSignal, onCleanup, createEffect, For } from 'solid-js';

import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { useTwitterAccounts } from '@/hooks/useTwitterAccounts';

interface UserImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export const UserImageModal = (props: UserImageModalProps) => {
  
  const [isVisible, setIsVisible] = createSignal(false);
  const [isRendered, setIsRendered] = createSignal(false);
  const [selectedAccount, setSelectedAccount] = createSignal("");

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
    }, 150); // Wait for the fade-out transition to complete
  };

  createEffect(() => {
    if (props.isOpen) {
      setIsRendered(true);
      // Use setTimeout to ensure the modal is rendered before setting it to visible
      setTimeout(() => setIsVisible(true), 50);
    }
  });

  const linkedAccountsQuery = useTwitterAccounts();

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
          {/* const usernames = data.map(account => account.username);
        console.log('Fetched Twitter account usernames:', usernames); */}
          <div class="mt-4">
            {linkedAccountsQuery.isLoading ? (
              <p>Loading accounts...</p>
            ) : linkedAccountsQuery.isError ? (
              <p>Error loading accounts: {linkedAccountsQuery.error.message}</p>
            ) : linkedAccountsQuery.data && linkedAccountsQuery.data.length > 0 ? (
              <Select
                options={linkedAccountsQuery.data.map(account => account.username) || []}
                placeholder="Select an account..."
                itemComponent={(props) => (
                  <SelectItem item={props.item}>@{props.item.textValue}</SelectItem>
                )}
                onChange={(value) => setSelectedAccount(value as any)}
              >
                <SelectTrigger class="w-[180px]">
                  <SelectValue<string>>{(state) => state.selectedOption() ? `@${state.selectedOption()}` : 'Select an account...'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <For each={linkedAccountsQuery.data || []}>
                    {(account) => (
                      <SelectItem item={account.username}>@{account.username}</SelectItem>
                    )}
                  </For>
                </SelectContent>
              </Select>
            ) : (
              <p>No linked Twitter accounts found.</p>
            )}
          </div>
          <div class="mt-4 flex justify-center">
            <Button onClick={() => console.log(`Post to ${selectedAccount()}`)}>
              Post to Twitter
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};
