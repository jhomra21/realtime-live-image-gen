import { createSignal, createEffect, Show } from 'solid-js'
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Badge } from './ui/badge'
import { Card } from './ui/card'

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://localhost:3000';

const TwitterAccountList = () => {
    const { user } = useAuth();
    const [isTwitterLinked, setIsTwitterLinked] = createSignal(false);
    const [linkedAccounts, setLinkedAccounts] = createSignal<Array<{ username: string }>>([]);

    const queryClient = useQueryClient();

    const twitterLinkQuery = createQuery(() => ({
        queryKey: ['twitterLink', (user() as any)?.id],
        queryFn: async () => {
            const currentUser = user();
            if (!currentUser) return { linked: false, username: null };
            const { data, error } = await supabase
                .from('user_linked_accounts')
                .select('provider, username')
                .eq('user_id', (currentUser as any).id)
                .eq('provider', 'twitter')
                .single();
            if (error) throw error;
            return { linked: !!data, username: data?.username || null };
        },
        enabled: !!user(),
    }));

    createEffect(() => {
        if (twitterLinkQuery.data !== undefined) {
            setIsTwitterLinked(twitterLinkQuery.data.linked);
        }
    });

    const twitterLinkedAccountsQuery = createQuery(() => ({
        queryKey: ['twitterLinkedAccounts', (user() as any)?.id],
        queryFn: async () => {
            const currentUser = user();
            if (!currentUser) return [];
            const { data, error } = await supabase
                .from('user_linked_accounts')
                .select('username')
                .eq('user_id', (currentUser as any).id)
                .eq('provider', 'twitter');
            if (error) throw error;
            return data || [];
        },
        enabled: !!user(),
    }));

    createEffect(() => {
        if (twitterLinkedAccountsQuery.data) {
            setLinkedAccounts(twitterLinkedAccountsQuery.data);
        }
    });

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
                    <Show when={linkedAccounts().length > 0}>
                        <div class="mt-2 flex items-center flex-wrap gap-2">
                            <p class="text-blue-100">Linked Twitter accounts</p>
                            {linkedAccounts().map(account => (
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