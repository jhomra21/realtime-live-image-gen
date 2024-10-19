import { createSignal, For, Show } from 'solid-js';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { z } from 'zod';
import { Button } from '../ui/button';
import { TextFieldRoot, TextFieldLabel } from '../ui/textfield';
import { TextArea } from '../ui/textarea';
import { useTwitterAccounts } from '@/hooks/useTwitterAccounts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../ui/toast';
import { supabase } from '@/lib/supabase';
import TwitterAccountList from '../TwitterAccountList';

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

const TweetSchema = z.object({
  text: z.string().max(280, "Tweet cannot exceed 280 characters"),
  accountUsername: z.string().nonempty("Please select a Twitter account"),
});

const TwitterPost = () => {
  const [tweetText, setTweetText] = createSignal('');
  const [selectedAccount, setSelectedAccount] = createSignal('');
  const queryClient = useQueryClient();

  const linkedAccountsQuery = useTwitterAccounts();

  const postTweetMutation = createMutation(() => ({
    mutationFn: async (tweetData: z.infer<typeof TweetSchema>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${API_BASE_URL}/twitter/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(tweetData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Failed to refresh Twitter token') {
          throw new Error('Twitter token expired. Please reauthorize your account.');
        }
        throw new Error(errorData.error || 'Failed to post tweet');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tweet posted",
        description: "Your tweet has been successfully posted.",
      });
      setTweetText('');
      setSelectedAccount('');
      queryClient.invalidateQueries({ queryKey: ['twitterAccounts'] });
    },
    onError: (error) => {
      console.error('Error posting tweet:', error);
      if (error.message === 'Twitter token expired. Please reauthorize your account.') {
        toast({
          title: "Reauthorization required",
          description: "Your Twitter account needs to be reauthorized. Please unlink and relink your account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to post tweet. Please try again.",
          variant: "destructive",
        });
      }
    },
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const result = TweetSchema.safeParse({ text: tweetText(), accountUsername: selectedAccount() });
    if (result.success) {
      console.log('Submitting tweet:', result.data);  // Add this log
      postTweetMutation.mutate(result.data);
    } else {
      toast({
        title: "Validation Error",
        description: result.error.issues[0].message,
        variant: "destructive",
      });
    }
  };

  return (
    <div class="max-w-2xl mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
      <h1 class="text-2xl font-bold text-white mb-6">Post a Tweet</h1>
      <form onSubmit={handleSubmit} class="space-y-4">
        <TextFieldRoot>
          <TextFieldLabel for="tweet-text" class="block text-sm font-medium text-gray-300 mb-2">
            Tweet Content
          </TextFieldLabel>
          <TextArea
            id="tweet-text"
            value={tweetText()}
            onInput={(e) => setTweetText(e.currentTarget.value)}
            placeholder="What's happening?"
            rows={4}
            class="w-full bg-gray-700 text-white border-gray-600 focus:border-blue-500 focus:ring-blue-500"
          />
          <p class="text-sm text-gray-400 mt-1">
            {280 - tweetText().length} characters remaining
          </p>
        </TextFieldRoot>

        <div class="mt-4">
          <Show
            when={!linkedAccountsQuery.isLoading && !linkedAccountsQuery.isError && linkedAccountsQuery.data && linkedAccountsQuery.data.length > 0}
            fallback={
              <Show
                when={linkedAccountsQuery.isLoading}
                fallback={<p>No linked Twitter accounts found.</p>}
              >
                <p>Loading accounts...</p>
              </Show>
            }
          >
            <Select
              options={linkedAccountsQuery.data?.map(account => account.username) || []}
              placeholder="Select an account..."
              itemComponent={(props) => (
                <SelectItem item={props.item}>@{props.item.textValue}</SelectItem>
              )}
              onChange={(value) => setSelectedAccount(value as string)}
            >
              <SelectTrigger class="w-[180px]">
                <SelectValue<string>>{(state) => {
                  const selected = linkedAccountsQuery.data?.find(account => account.username === state.selectedOption());
                  return selected ? `@${selected.username}` : 'Select an account...';
                }}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <For each={linkedAccountsQuery.data || []}>
                  {(account) => (
                    <SelectItem item={account.username}>@{account.username}</SelectItem>
                  )}
                </For>
              </SelectContent>
            </Select>
          </Show>
        </div>

        <Button
          type="submit"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={postTweetMutation.isPending}
        >
          {postTweetMutation.isPending ? 'Posting...' : 'Post Tweet'}
        </Button>
      </form>
      <TwitterAccountList />
    </div>
  );
}

export default TwitterPost;
