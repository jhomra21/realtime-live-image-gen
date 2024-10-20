import { createSignal, createEffect, Show, For } from 'solid-js'
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { useTwitterAccounts } from '@/hooks/useTwitterAccounts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { toast } from './ui/toast'

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';

const TwitterAccountList = () => {
    const { user } = useAuth();
    const [isLinking, setIsLinking] = createSignal(false);
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = createSignal(false);
    const [clickedAccount, setClickedAccount] = createSignal('');
    const [isConfirmed, setIsConfirmed] = createSignal(false);

    const twitterAccountsQuery = useTwitterAccounts();

    const isTwitterLinked = () => twitterAccountsQuery.data && twitterAccountsQuery.data.length > 0;

    const linkTwitterMutation = createMutation(() => ({
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('No active session');
            }
            const response = await fetch(`${API_BASE_URL}/twitter/auth/v1`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to initiate Twitter authentication');
            }
            const { authUrl, state } = await response.json();
            // Store the state in localStorage
            localStorage.setItem('twitterAuthState', state);
            // Use window.open instead of window.location.href
            window.open(authUrl, '_blank', 'width=600,height=600');
        },
        onSuccess: () => {
            setIsLinking(true);
        },
        onError: (error) => {
            console.error('Error linking Twitter account:', error);
            toast({
                title: "Error",
                description: "Failed to link Twitter account. Please try again.",
            });
        }
    }));

    const removeTwitterAccount = createMutation(() => ({
        mutationFn: async (username: string) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('No active session');
            }
            const { error } = await supabase
                .from('user_linked_accounts')
                .delete()
                .match({ 
                    user_id: session.user.id, 
                    provider: 'twitter', 
                    username: username 
                });
            
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['twitterAccounts'] });
            toast({
                title: "Account removed",
                description: "The Twitter account has been unlinked successfully.",
            });
        },
        onError: (error) => {
            console.error('Error removing Twitter account:', error);
            toast({
                title: "Error",
                description: "Failed to remove the Twitter account. Please try again.",
                variant: "destructive",
            });
        },
    }));

    const handleXClick = (username: string) => {
        setClickedAccount(username);
        setIsConfirmed(false);  // Reset confirmation state
        setIsDialogOpen(true);
    };

    const handleRemoveAccount = (username: string) => {
        if (!isConfirmed()) {
            setIsConfirmed(true);
            return;
        }
        removeTwitterAccount.mutate(username, {
            onSuccess: () => {
                setIsDialogOpen(false);
                setIsConfirmed(false);
            },
        });
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setIsConfirmed(false);  // Reset confirmation state when dialog is closed
    };

    return (
        <Show when={user()}>
            <div class="mt-4">
                <Card class="p-4 bg-gray-800 border-gray-700">
                    <Button
                        onClick={() => linkTwitterMutation.mutate()}
                        disabled={linkTwitterMutation.isPending}
                        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {linkTwitterMutation.isPending ? 'Linking...' : 'Link Twitter Account'}
                    </Button>
                    <Show when={isTwitterLinked()}>
                        <div class="mt-2 flex items-center flex-wrap gap-2">
                            <p class="text-blue-100">Linked Twitter accounts</p>
                            <For each={twitterAccountsQuery.data}>
                                {(account) => (
                                    <div class="relative group inline-flex">
                                        <Badge variant="outline" class="bg-blue-900 text-white border-blue-700 p-2 transition-all duration-200 group-hover:pr-8">
                                            @{account.username}
                                        </Badge>
                                        <div 
                                            class="absolute right-0 top-0 bottom-0 w-1/5 opacity-0 group-hover:opacity-100 flex bg-red-500 text-white items-center justify-center cursor-pointer rounded-r-md transition-all duration-200"
                                            onClick={() => handleXClick(account.username)}
                                        >
                                            x
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </Card>
            </div>
            <Dialog 
                open={isDialogOpen()} 
                onOpenChange={handleDialogClose}
            >
                <DialogContent class="bg-gray-800 text-white border border-gray-700">
                    <DialogHeader>
                        <DialogTitle class="text-xl font-bold text-white-100">Remove Twitter Account</DialogTitle>
                        <div class="border-b border-gray-700 w-full my-4"></div>
                    </DialogHeader>
                    <p class="text-gray-300">Are you sure you want to remove @{clickedAccount()}?</p>
                    
                    <div class="flex justify-end gap-2 mt-6">
                        <Button 
                            variant="outline" 
                            onClick={handleDialogClose}
                            class="bg-transparent text-gray-300 border-gray-600 hover:bg-gray-200"
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => handleRemoveAccount(clickedAccount())}
                            disabled={removeTwitterAccount.isPending}
                            class="bg-red-600 text-white hover:bg-red-700"
                        >
                            {removeTwitterAccount.isPending ? 'Removing...' : 
                             isConfirmed() ? 'Remove' : "I'm sure"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Show>
    );
};

export default TwitterAccountList;
