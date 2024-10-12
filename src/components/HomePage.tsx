import { A } from '@solidjs/router';
import Footer from './Footer';

const HomePage = () => {
  return (
    <div class="page-transition flex flex-col min-h-screen">
      <main class="flex-grow flex justify-center px-4 py-12">
        <div class="w-full max-w-4xl bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 overflow-hidden">
          <div class="p-8">
            <section class="text-center mb-12">
              <h1 class="text-5xl font-bold mb-4">Real Time Image Generation</h1>
              <p class="text-xl mb-8">Create stunning visuals with the power of Flux AI Image models</p>
              <A
                href="/generate"
                class="inline-block px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Generating
              </A>
            </section>

            <section class="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
              <div>
                <h2 class="text-3xl font-bold mb-4 text-blue-300">Unleash Your Creativity</h2>
                <p class="text-lg text-gray-300">
                  Explore the capabilities of FLUX image generation models, designed to empower your creative vision.
                </p>
              </div>
              <div>
                <h2 class="text-3xl font-bold mb-4 text-blue-300">How It Works</h2>
                <ol class="list-decimal list-inside text-lg text-gray-300">
                  <li>Enter a descriptive prompt</li>
                  <li>Choose your preferred settings</li>
                  <li>Watch as AI generates your image</li>
                  <li>Download and use your creation</li>
                </ol>
              </div>
            </section>

            {/* Updated "Powered by" section with improved logo visibility and links */}
            <section class="mt-12 pt-8 border-t border-gray-700">
              <h2 class="text-2xl font-bold mb-6 text-center text-blue-300">Powered by</h2>
              <div class="flex justify-center items-center space-x-12">
                <a href="https://blackforestlabs.ai/" target="_blank" rel="noopener noreferrer" class="bg-white p-4 rounded-lg shadow-md transition-transform hover:scale-105">
                  <img 
                    src="/black-forest-labs-logo.png" 
                    alt="Black Forest Labs Logo"
                    class="h-12 w-auto"
                  />
                </a>
                <a href="https://www.together.ai" target="_blank" rel="noopener noreferrer" class="bg-white p-4 rounded-lg shadow-md transition-transform hover:scale-105">
                  <img 
                    src="/together-ai-logo.png" 
                    alt="Together AI Logo"
                    class="h-12 w-auto"
                  />
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
