import { Show, createSignal, createEffect, For } from 'solid-js';
import { downloadImage } from '../utils/imageUtils';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { createMutation, createQuery } from '@tanstack/solid-query';
import { useAuth } from '../hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { User } from '@supabase/supabase-js';

// Add this interface definition
interface LinkedAccount {
  id: string;  // This is likely the Supabase ID
  username: string;
  twitter_account_id: string;  // Add this field for the actual Twitter account ID
}

  const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

interface ImageModalProps {
  imageData: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function normalizeUrl(url: string): string {
  if (url.startsWith('https://https://')) {
    return url.replace('https://https://', 'https://');
  }
  if (!url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

const ImageModal = (props: ImageModalProps) => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isRendered, setIsRendered] = createSignal(false);
  const [selectedAccount, setSelectedAccount] = createSignal<LinkedAccount | null>(null);
  const [tweetText, setTweetText] = createSignal('');
  const { user } = useAuth();

  const handleDownload = (e: Event) => {
    e.stopPropagation();
    if (props.imageData) {
      downloadImage(props.imageData);
    }
  };

  const uploadMutation = createMutation(() => ({
    mutationFn: async (imageData: string) => {
      const base64Data = imageData.split(',')[1] || imageData;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      const formData = new FormData();
      formData.append('image', blob, 'image.png');

      const uploadResponse = await fetch(`${API_BASE_URL}/api/uploadImage`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }
      return uploadResponse.json();
    },
    onSuccess: async (data) => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const normalizedUrl = normalizeUrl(data.url);
        await supabase.from('user_images').insert({
          user_id: userData.user.id,
          image_url: normalizedUrl,
        });
      }
      setIsVisible(false);
    },
  }));

  const handleSaveToR2 = async (e: Event) => {
    e.stopPropagation();
    if (props.imageData) {
      try {
        await uploadMutation.mutateAsync(props.imageData);
        console.log("Image uploaded successfully");
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    } else {
      console.error("No image data available");
    }
  };

  const linkedAccountsQuery = createQuery(() => ({
    queryKey: ['linkedAccounts', (user() as User | null)?.id],
    queryFn: async (): Promise<LinkedAccount[]> => {
      const currentUser = user() as User | null;
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from('user_linked_accounts')
        .select('id, username')
        .eq('user_id', currentUser.id)
        .eq('provider', 'twitter');
      if (error) throw error;
      return data.map(account => ({
        ...account,
        twitter_account_id: account.id // Assuming 'id' is the Twitter account ID
      }));
    },
    enabled: !!user(),
  }));

  const postTweetMutation = createMutation(() => ({
    mutationFn: async (variables: { userId: string; twitterAccountId: string; imageUrl: string; tweetText: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/twitter/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(variables),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to post tweet: ${JSON.stringify(errorData)}`);
      }
      return response.json();
    },
    onSuccess: () => {
      alert('Tweet posted successfully!');
    },
    onError: (error: Error) => {
      console.error('Error posting tweet:', error);
      alert(`Failed to post tweet. ${error.message}`);
    },
  }));

  const handlePostTweet = async (e: Event) => {
    e.stopPropagation();
    const currentUser = user();
    if (!currentUser || !selectedAccount() || !props.imageData) return;
    
    try {
      // First, upload the image to R2
      const uploadResult = await uploadMutation.mutateAsync(props.imageData);
      const imageUrl = normalizeUrl(uploadResult.url);

      // Debug: Log the selected account value
      console.log('Selected account:', selectedAccount());

      // Ensure we're using the correct ID from the selected account
      const selectedAccountData = selectedAccount() as LinkedAccount;
      if (!selectedAccountData || !selectedAccountData.twitter_account_id) {
        console.error('Invalid Twitter account:', selectedAccountData);
        throw new Error('Invalid Twitter account selected');
      }

      // Then post the tweet with the R2 image URL
      await postTweetMutation.mutateAsync({
        userId: String((currentUser as User).id),
        twitterAccountId: selectedAccountData.twitter_account_id,
        imageUrl,
        tweetText: tweetText(),
      });
    } catch (error) {
      console.error('Error in tweet posting process:', error);
      alert('An error occurred while posting the tweet. Please try again.');
    }
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
      props.onClose();
    }, 300);
  };

  createEffect(() => {
    if (props.isOpen) {
      setIsRendered(true);
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
            src={`data:image/png;base64,${props.imageData}`}
            alt="Expanded image"
            class="max-w-full max-h-[60vh] object-contain mx-auto"
          />
        </div>
        <div class="mt-4 space-y-4 w-full max-w-md">
          <div class="flex space-x-4">
            <Button
              onClick={handleDownload}
              class="flex-1 px-6 py-2 bg-blue-600 bg-opacity-80 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              Download
            </Button>
            <Show when={user()}>
              <Button
                onClick={handleSaveToR2}
                class="flex-1 px-6 py-2 bg-green-600 bg-opacity-80 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Saving...' : 'Save to R2'}
              </Button>
            </Show>
          </div>
          
          <Show when={user() && linkedAccountsQuery.data?.length}>
            <div class="space-y-2">
              <Select
                options={linkedAccountsQuery.data || []}
                onChange={(value) => {
                  console.log('Selected value:', value); // Debug: Log the selected value
                  setSelectedAccount(value as LinkedAccount | null);
                }}
                itemComponent={(props) => (
                  <SelectItem item={props.item}>@{props.item.rawValue.username}</SelectItem>
                )}
                optionValue="id"
                optionTextValue="username"
              >
                <SelectTrigger>
                  <SelectValue<LinkedAccount>>
                    {(state) => {
                      const selected = state.selectedOption();
                      return selected ? `@${selected.username}` : "Select Twitter account";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
              <Input
                type="text"
                placeholder="Tweet text"
                value={tweetText()}
                onInput={(e) => setTweetText(e.currentTarget.value)}
                class="w-full"
                maxLength={280}
              />
              <Button
                onClick={handlePostTweet}
                disabled={!selectedAccount() || postTweetMutation.isPending}
                class="w-full px-6 py-2 bg-blue-500 bg-opacity-80 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
              >
                {postTweetMutation.isPending ? 'Posting...' : 'Post to Twitter'}
              </Button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default ImageModal;
