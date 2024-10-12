import { createSignal, Show, createEffect } from 'solid-js';
import { Auth } from './Auth';
import { UserInfo } from './UserInfo';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import GenerateImage from './GenerateImage';

const HomePage = () => {
  const [session, setSession] = createSignal<Session | null>(null);
  const [showAuth, setShowAuth] = createSignal(false);

  createEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session || null);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || null);
    });
  });

  return (
    <div class="min-h-screen bg-gray-900 text-gray-100">
      {/* Old Nav
      <nav class="bg-gray-800 p-4">
        <div class="container mx-auto flex justify-between items-center">
          <h1 class="text-2xl font-bold">Home</h1>
          <div class="flex items-center space-x-4">
            <a href="/generate" class="text-white hover:text-blue-300">Generate Image</a>
            {session() ? (
              <UserInfo session={session()!} />
            ) : (
              <button 
                onClick={() => setShowAuth(true)} 
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Login / Sign Up
              </button>
            )}
          </div>
        </div>
      </nav> 

      <Show when={showAuth()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <Auth />
            <button
              onClick={() => setShowAuth(false)}
              class="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Show>
    */}
      <main class="container mx-auto mt-8">
        <GenerateImage />
      </main>
    </div>
  );
};

export default HomePage;
