import { createSignal, createEffect } from 'solid-js';
import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { supabase } from '../lib/supabase';
import { AccountSchema } from '../types/schema';
import { toast } from '@/components/ui/toast';

export function useUserCoins() {
  const queryClient = useQueryClient();
  const [localCoins, setLocalCoins] = createSignal(0);

  const accountQuery = createQuery(() => ({
    queryKey: ['account'],
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

    // Invalidate the query to trigger a refresh
    queryClient.invalidateQueries({ queryKey: ['account'] });
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

    // Invalidate the query to trigger a refresh
    queryClient.invalidateQueries({ queryKey: ['account'] });
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
