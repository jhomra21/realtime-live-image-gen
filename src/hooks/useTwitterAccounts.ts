import { createQuery } from '@tanstack/solid-query';
import { supabase } from '@/lib/supabase';
// import { useAuth } from '../hooks/useAuth';

export function useTwitterAccounts() {
  // const { user } = useAuth();
  

  return createQuery(() => ({
    queryKey: ['twitterAccounts'],
    queryFn: async () => {
      
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) return [];
      try {
        const { data, error } = await supabase
          .from('user_linked_accounts')
          .select('username')
          .eq('user_id', userData.user.id)
          .eq('provider', 'twitter');

        if (error) {
          console.error('Error fetching Twitter accounts:', error);
          return [];
        }

        return data || [];
      } catch (error) {
        console.error('Error fetching Twitter accounts:', error);
        return [];
      }
    },
    // enabled: !!user(),
  }));
}

