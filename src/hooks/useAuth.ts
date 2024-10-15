import { createSignal, createEffect } from 'solid-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = createSignal(null);

  createEffect(() => {
    console.log("Auth effect running");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Got session:", session);
      setUser(session?.user ?? null as any);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed:", _event, session);
      setUser(session?.user ?? null as any);
    });

    return () => subscription.unsubscribe();
  });

  const signOut = async () => {
    console.log("Signing out...");
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear all local storage
      // Remove user-related data from localStorage
      const keysToKeep = ['storedImages'];
      Object.keys(localStorage).forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Clear all session storage
      sessionStorage.clear();

      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // Reset the user state
      setUser(null);

      console.log("Cleared all local storage, session storage, and cookies");

      // Force reload the page to ensure all components re-render and all state is reset
      window.location.href = '/';
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  return { user, signOut };
}
