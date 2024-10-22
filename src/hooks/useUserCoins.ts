import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { supabase } from '../lib/supabase';
import { AccountSchema, type Account } from '../types/schema';
import { toast } from '@/components/ui/toast';
import { z } from 'zod';

// Query key constant
const ACCOUNT_QUERY_KEY = ['account'] as const;

// Validate realtime payload
const RealtimeAccountPayloadSchema = z.object({
  new: AccountSchema.partial(),
  old: AccountSchema.partial(),
  eventType: z.string(),
  commit_timestamp: z.string(),
  errors: z.nullable(z.any()),
  schema: z.string(),
  table: z.string()
}).passthrough(); // Add passthrough to allow additional fields from Supabase

type RealtimeAccountPayload = z.infer<typeof RealtimeAccountPayloadSchema>;

export function useUserCoins() {
  const queryClient = useQueryClient();
  const [localCoins, setLocalCoins] = createSignal(0);

  const accountQuery = createQuery(() => ({
    queryKey: ACCOUNT_QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return AccountSchema.parse(data);
    },
  }));

  // Set up realtime subscription
  createEffect(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase.channel('account_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          try {
            console.log('Raw payload:', payload); // Debug log
            const validatedPayload = RealtimeAccountPayloadSchema.parse(payload);
            console.log('Account change received:', validatedPayload);
            
            if (validatedPayload.new && Object.keys(validatedPayload.new).length > 0) {
              const currentData = queryClient.getQueryData(ACCOUNT_QUERY_KEY) as Account | undefined;
              const updatedData = {
                ...currentData,
                ...validatedPayload.new,
              };
              
              queryClient.setQueryData(
                ACCOUNT_QUERY_KEY, 
                updatedData
              );
            }
          } catch (error) {
            console.error('Invalid realtime payload:', error);
            console.error('Payload that caused error:', payload);
          }
        }
      )
      .subscribe();

    // Cleanup subscription when component unmounts
    onCleanup(() => {
      channel.unsubscribe();
    });
  });

  createEffect(() => {
    if (accountQuery.data) {
      setLocalCoins(accountQuery.data.coins);
    }
  });

  const subtractCoins = async (amount: number) => {
    const currentCoins = accountQuery.data?.coins ?? 0;
    if (currentCoins < amount) {
      throw new Error('Insufficient coins');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('accounts')
      .update({ coins: currentCoins - amount })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update coins",
        variant: "destructive"
      });
      throw error;
    }
  };

  const addCoins = async (amount: number) => {
    const currentCoins = accountQuery.data?.coins ?? 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('accounts')
      .update({ coins: currentCoins + amount })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update coins",
        variant: "destructive"
      });
      throw error;
    }
  };

  const hasEnoughCoins = () => (accountQuery.data?.coins ?? 0) >= 4;

  return {
    coins: () => accountQuery.data?.coins ?? 0,
    subtractCoins,
    addCoins,
    hasEnoughCoins,
    isLoading: accountQuery.isLoading,
    error: accountQuery.error,
  };
}
