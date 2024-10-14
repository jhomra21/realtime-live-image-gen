import { render } from 'solid-js/web'
import { Component, createSignal, onMount, lazy, createEffect, Show } from 'solid-js'
import { createQuery, QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { Router, Route, A, RouteSectionProps, useLocation } from '@solidjs/router'
import HomePage from '../components/HomePage'
import GenerateImage from '../components/GenerateImage'
import { Auth } from '../components/Auth'
import { supabase } from '../lib/supabase'
import { UserInfo } from '../components/UserInfo'
import { Session } from '@supabase/supabase-js'
import '../app.css'
import AboutPage from '../components/AboutPage'
import { Transition } from 'solid-transition-group';

// const GenerateImage = lazy(() => import("../components/GenerateImage"));

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
  const [scrolled, setScrolled] = createSignal(false);

  createEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session || null);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || null);
    });
  });

  onMount(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });

  return (
    <nav
      class={`fixed top-0 left-0 right-0 z-10 transition-all duration-300 
        ${scrolled() 
          ? 'bg-gray-900/70 backdrop-blur-md shadow-lg border-b border-gray-700/50' 
          : 'bg-transparent border-b border-gray-700/30'
        }`}
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <A href="/" class="text-white text-xl font-bold" activeClass="text-blue-300" end>
              Home
            </A>
          </div>
          <div class="flex items-center space-x-6">
            <A 
              href="/generate" 
              class="text-white hover:text-blue-300 transition-colors border-b-2 border-transparent hover:border-blue-300" 
              activeClass="text-blue-300 border-blue-300"
            >
              Generate Image
            </A>
            <A 
              href="/about" 
              class="text-white hover:text-blue-300 transition-colors border-b-2 border-transparent hover:border-blue-300" 
              activeClass="text-blue-300 border-blue-300"
            >
              About
            </A>
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
      </div>
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
    </nav>
  );
};

const PageTransition: Component<RouteSectionProps> = (props) => {
  const location = useLocation();
  return (
    <Transition name="fade">
      {props.children}
    </Transition>
  );
};

const Layout: Component<RouteSectionProps> = (props) => (
  <div class="min-h-screen bg-gray-900 text-white">
    <Nav />
    <div class="pt-16">
      <PageTransition params={props.params} location={props.location} data={props.data}>{props.children}</PageTransition>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Router root={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/generate" component={GenerateImage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/login" component={Auth} />
      <Route path="/signup" component={Auth} />
    </Router>
  </QueryClientProvider>
);

render(() => <App />, document.getElementById('root')!)
