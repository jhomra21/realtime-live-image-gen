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

      console.log('Fetching account data for user:', user.id);

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Account query error:', error);
        throw error;
      }

      if (!data) {
        console.error('No account data found');
        throw new Error('No account data found');
      }

      return AccountSchema.parse(data);
    },
    retry: 3, // Add retry attempts
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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

  const updateCoins = async (newAmount: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found in updateCoins');
        throw new Error('User not authenticated');
      }

      // Validate the new amount
      if (typeof newAmount !== 'number' || isNaN(newAmount)) {
        console.error('Invalid amount in updateCoins:', newAmount);
        throw new Error('Invalid coin amount');
      }

      // Ensure coins is a non-negative integer
      const validatedAmount = Math.max(0, Math.floor(newAmount));
      console.log('Attempting to update coins:', {
        userId: user.id,
        newAmount: validatedAmount,
        environment: import.meta.env.MODE
      });

      const { data, error } = await supabase
        .from('accounts')
        .update({ 
          coins: validatedAmount,
          updated_at: new Date().toISOString() // Add this to ensure the row is actually updated
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', {
          error,
          userId: user.id,
          amount: validatedAmount,
          environment: import.meta.env.MODE
        });
        throw error;
      }

      if (!data) {
        console.error('No data returned from update');
        throw new Error('Failed to update coins');
      }

      return AccountSchema.parse(data);
    } catch (error) {
      console.error('updateCoins error:', {
        error,
        environment: import.meta.env.MODE,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };

  const subtractCoins = async (amount: number) => {
    try {
      const currentCoins = accountQuery.data?.coins;
      if (typeof currentCoins !== 'number' || isNaN(currentCoins)) {
        throw new Error('Current coin balance not available');
      }

      if (currentCoins < amount) {
        throw new Error('Insufficient coins');
      }

      const newCoinAmount = currentCoins - amount;
      const updatedAccount = await updateCoins(newCoinAmount);

      // Update local query cache with the validated response
      queryClient.setQueryData(ACCOUNT_QUERY_KEY, updatedAccount);

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update coins",
        variant: "destructive"
      });
      throw error;
    }
  };

  const addCoins = async (amount: number) => {
    try {
      const currentCoins = accountQuery.data?.coins;
      if (typeof currentCoins !== 'number' || isNaN(currentCoins)) {
        throw new Error('Current coin balance not available');
      }

      const newCoinAmount = currentCoins + amount;
      const updatedAccount = await updateCoins(newCoinAmount);

      // Update local query cache with the validated response
      queryClient.setQueryData(ACCOUNT_QUERY_KEY, updatedAccount);

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update coins",
        variant: "destructive"
      });
      throw error;
    }
  };

  const hasEnoughCoins = () => {
    const currentCoins = accountQuery.data?.coins;
    return typeof currentCoins === 'number' && !isNaN(currentCoins) && currentCoins >= 4;
  };

  return {
    coins: () => {
      const coins = accountQuery.data?.coins;
      return typeof coins === 'number' && !isNaN(coins) ? coins : 0;
    },
    subtractCoins,
    addCoins,
    hasEnoughCoins,
    isLoading: accountQuery.isLoading,
    error: accountQuery.error,
  };
}
