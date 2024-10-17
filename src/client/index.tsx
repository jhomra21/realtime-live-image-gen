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
import Footer from '@/components/Footer'
import { useAuth } from '../hooks/useAuth';
import TwitterLinkError from '../components/TwitterLinkError'

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
  const { user } = useAuth();
  const [scrolled, setScrolled] = createSignal(false);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  onMount(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    // Add click event listener to close menu when clicking outside
    const handleOutsideClick = (event: MouseEvent) => {
      const nav = document.querySelector('nav');
      if (isMenuOpen() && nav && !nav.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleOutsideClick);
    };
  });

  const toggleMenu = (event: Event) => {
    event.stopPropagation();
    setIsMenuOpen(!isMenuOpen());
  };

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
          <div class="hidden md:flex items-center space-x-6">
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
            {user() ? (
              <UserInfo session={{ user: user() }} />
            ) : (
              <Auth />
            )}
          </div>
          <div class="md:hidden">
            <button
              onClick={toggleMenu}
              class="text-white hover:text-blue-300 focus:outline-none"
            >
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d={isMenuOpen() ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Mobile menu */}
      <div
        class={`md:hidden ${
          isMenuOpen() ? 'block' : 'hidden'
        } bg-gray-900 border-t border-gray-700/30`}
      >
        <div class="px-2 pt-2 pb-3 space-y-1">
          <A
            href="/generate"
            class="block px-3 py-2 rounded-md text-base font-medium text-white hover:text-blue-300 hover:bg-gray-800"
            activeClass="text-blue-300 bg-gray-800"
          >
            Generate Image
          </A>
          <A
            href="/about"
            class="block px-3 py-2 rounded-md text-base font-medium text-white hover:text-blue-300 hover:bg-gray-800"
            activeClass="text-blue-300 bg-gray-800"
          >
            About
          </A>
          <div class="px-3 py-2">
            {user() ? (
              <div class="contents items-cente">
                <UserInfo session={{ user: user() }} />
              </div>
            ) : (
              <Auth />
            )}
          </div>
        </div>
      </div>
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
      <Route path="/twitter-linked-error" component={TwitterLinkError} />
    </Router>
    <Footer />
  </QueryClientProvider>
);

render(() => <App />, document.getElementById('root')!)
