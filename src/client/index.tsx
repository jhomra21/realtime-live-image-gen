import { render } from 'solid-js/web'
import { Component, createSignal, onMount, lazy, createEffect, Show } from 'solid-js'
import { createQuery, QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { Router, Route, A, RouteSectionProps } from '@solidjs/router'
import HomePage from '../components/HomePage'
import { Auth } from '../components/Auth'
import { supabase } from '../lib/supabase'
import { UserInfo } from '../components/UserInfo'
import { Session } from '@supabase/supabase-js'
import '../app.css'

const GenerateImage = lazy(() => import("../components/GenerateImage"));

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://localhost:3000';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

const Nav = () => {
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
  const [scrolled, setScrolled] = createSignal(false);

  onMount(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });

  return (
    <nav class={`fixed top-0 left-0 right-0 z-10 transition-all duration-300 ${scrolled() ? 'bg-gray-800/80 backdrop-blur-md' : 'bg-gray-800'}`}>
      <div class="container mx-auto flex justify-between items-center py-4 px-6">
        <A href="/" class="text-white text-xl font-bold" activeClass="underline" end>
          Home
        </A>
        <div class="flex items-center space-x-4">
          <A href="/generate" class="text-white" activeClass="underline">
            Generate Image
          </A>
          {/* Old sign in/up
          <A href="/login" class="text-white" activeClass="underline">
            Login
          </A>
          <A href="/signup" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Sign Up
          </A> */}
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
        </div>
      </div>
    </nav>
  );
};

const Layout: Component<RouteSectionProps> = (props) => (
  <div class="min-h-screen bg-gray-900 text-white">
    <Nav />
    <div class="container mx-auto pt-20 px-4">
      {props.children}
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Router root={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/generate" component={GenerateImage} />
      <Route path="/login" component={Auth} />
      <Route path="/signup" component={Auth} />
    </Router>
  </QueryClientProvider>
);

render(() => <App />, document.getElementById('root')!)
