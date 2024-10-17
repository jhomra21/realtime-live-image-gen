import { createSignal, createEffect, Show } from 'solid-js'
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { useTwitterAccounts } from '@/hooks/useTwitterAccounts'

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

const TwitterAccountList = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const twitterAccountsQuery = useTwitterAccounts();

    const isTwitterLinked = () => twitterAccountsQuery.data && twitterAccountsQuery.data.length > 0;

    const linkTwitterAccount = createMutation(() => ({
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('No active session');
            }
            const response = await fetch(`${API_BASE_URL}/twitter/auth`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to initiate Twitter authentication');
            }
            const { authUrl } = await response.json();
            const finalAuthUrl = `${authUrl}&userId=${session.user.id}`;
            window.location.href = finalAuthUrl;
        },
        onError: (error) => {
            console.error('Error linking Twitter account:', error);
            // Handle error (e.g., show an error message to the user)
        },
    }));

    return (
        <Show when={user()}>
            <div class="mt-4">
                <Card class="p-4 bg-gray-800 border-gray-700">
                    <Button
                        onClick={() => linkTwitterAccount.mutate()}
                        disabled={linkTwitterAccount.isPending}
                        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {linkTwitterAccount.isPending ? 'Linking...' : 'Link Twitter Account'}
                    </Button>
                    <Show when={isTwitterLinked()}>
                        <div class="mt-2 flex items-center flex-wrap gap-2">
                            <p class="text-blue-100">Linked Twitter accounts</p>
                            {twitterAccountsQuery.data?.map(account => (
                                <Badge variant="outline" class="bg-blue-900 text-white border-blue-700 p-2">
                                    @{account.username}
                                </Badge>
                            ))}
                        </div>
                    </Show>
                </Card>
            </div>
        </Show>
    );
};

export default TwitterAccountList;
