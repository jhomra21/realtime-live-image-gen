import { createSignal, createEffect } from 'solid-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = createSignal(null);

  createEffect(() => {
    console.log("Auth effect running");
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session error:", error);
        return;
      }
      console.log("Got session:", session);
      setUser(session?.user ?? null as any);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session);
      setUser(session?.user ?? null as any);
    });

    return () => subscription.unsubscribe();
  });

  const signOut = async () => {
    console.log("Signing out...");
    try {
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("Supabase signOut error:", error);
        // Continue with local cleanup even if Supabase signOut fails
      }
    } catch (error) {
      console.error("Error during Supabase sign out:", error);
      // Continue with local cleanup even if an error occurs
    }

    // Clear all local storage
    // Remove user-related data from localStorage
    // Preserve 'previousImages' in localStorage
    const previousImages = localStorage.getItem('previousImages');
    const previousUserCoins = localStorage.getItem('userCoins');
    localStorage.clear();
    if (previousImages) {
      localStorage.setItem('previousImages', previousImages);
    }
    if (previousUserCoins) {
      localStorage.setItem('userCoins', previousUserCoins);
    }

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
  };

  return { user, signOut };
}
