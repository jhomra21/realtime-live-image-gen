import { Show, createSignal, createEffect, For } from 'solid-js';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { createMutation } from '@tanstack/solid-query';
import { supabase } from '@/lib/supabase';
import { toast } from './ui/toast';

interface UserImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  linkedAccounts: { username: string }[];
  isLoadingAccounts: boolean;
  accountsError: Error | null;
}

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

export const UserImageModal = (props: UserImageModalProps) => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isRendered, setIsRendered] = createSignal(false);
  const [selectedAccount, setSelectedAccount] = createSignal("");
  const [tweetText, setTweetText] = createSignal("");

  const uploadAndTweetMutation = createMutation(() => ({
    mutationFn: async ({ imageUrl, accountUsername, text }: { imageUrl: string; accountUsername: string; text: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${API_BASE_URL}/twitter/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ imageUrl, accountUsername, text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post tweet');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tweet posted successfully!",
      });
      closeModal();
    },
    onError: (error) => {
      console.error('Error posting tweet:', error);
      toast({
        title: "Error",
        description: "Failed to post tweet. Please try again.",
        variant: "destructive",
      });
    },
  }));

  const handlePostTweet = () => {
    if (!selectedAccount()) {
      toast({
        title: "Error",
        description: "Please select a Twitter account.",
        variant: "destructive",
      });
      return;
    }
    uploadAndTweetMutation.mutate({ 
      imageUrl: props.imageUrl, 
      accountUsername: selectedAccount(), 
      text: tweetText() 
    });
  };
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
          <textarea
            value={tweetText()}
            onInput={(e) => setTweetText(e.currentTarget.value)}
            placeholder="What's happening?"
            rows={4}
            class="w-full mb-4"
          />
          <p class="text-sm text-gray-500 mb-4">
            {280 - tweetText().length} characters remaining
          </p>
          <Select
            options={props.linkedAccounts.map(account => account.username) || []}
            placeholder="Select an account..."
            itemComponent={(props) => (
              <SelectItem item={props.item}>@{props.item.textValue}</SelectItem>
            )}
            onChange={(value) => setSelectedAccount(value as string)}
          >
            <SelectTrigger class="w-full mb-4">
              <SelectValue<string>>
                {(state) => state.selectedOption() || 'Select an account...'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <For each={props.linkedAccounts.map(account => account.username as any) || []}>
                {(account) => (
                  <SelectItem item={account.username}>@{account.username}</SelectItem>
                )}
              </For>
            </SelectContent>
          </Select>
          <div class="flex justify-end space-x-2">
            <Button onClick={closeModal} variant="outline">Cancel</Button>
            <Button 
              onClick={handlePostTweet}
              disabled={uploadAndTweetMutation.isPending}
            >
              {uploadAndTweetMutation.isPending ? 'Posting...' : 'Post to Twitter'}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};
