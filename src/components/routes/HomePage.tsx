import { A } from '@solidjs/router';
import { FiArrowRight } from 'solid-icons/fi';


const HomePage = () => {
  return (
    <div class="flex justify-center px-4 py-4 pb-24">
      <div class="w-full max-w-full bg-gray-900/80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
        <div class="p-12">
          <section class="text-center mb-16">
            <div class="relative overflow-hidden rounded-lg mb-6">
              <div class="absolute inset-0 bg-blue-600 opacity-75 blur-xl"></div>
              <div class="relative bg-gray-900 bg-opacity-80 backdrop-blur-md p-6 shadow-lg">
                <div class="absolute rounded-tl-lg top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400"></div>
                <div class="absolute rounded-tr-lg top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400"></div>
                <div class="absolute rounded-bl-lg bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400"></div>
                <div class="absolute rounded-br-lg bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400"></div>

                <h1 class="text-5xl sm:text-6xl font-bold mb-6 text-white page-title">Real-Time AI Image Generation</h1>
              </div>
            </div>
            
            <p class="text-2xl mb-10 text-gray-300">Harness the power of FLUX AI to create stunning visuals in seconds</p>
            <A
              href="/generate"
              class="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-xl font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Creating <FiArrowRight class="ml-2" />
            </A>
          </section>

          <section class="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
            <div>
              <h2 class="text-3xl font-bold mb-6 text-blue-300">Unleash Your Creativity</h2>
              <ul class="text-lg text-gray-300 space-y-4">
                <li>• Generate unique images from text descriptions</li>
                <li>• Perfect for designers, marketers, and creatives</li>
                <li>• Instantly bring your ideas to life</li>
              </ul>
            </div>
            <div>
              <h2 class="text-3xl font-bold mb-6 text-blue-300">How It Works</h2>
              <ol class="list-decimal list-inside text-lg text-gray-300 space-y-4">
                <li>Enter a detailed text prompt describing your desired image</li>
                <li>Customize generation settings for optimal results</li>
                <li>Watch in real-time as AI creates your unique visual</li>
                <li>Download and use your AI-generated masterpiece</li>
              </ol>
            </div>
          </section>

          <section class="mb-16">
            <h2 class="text-3xl font-bold mb-6 text-center text-blue-300">Key Features</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div class="bg-gray-800/50 p-6 rounded-lg">
                <h3 class="text-xl font-semibold mb-3 text-white">Lightning Fast</h3>
                <p class="text-gray-300">Generate high-quality images in seconds, not minutes</p>
              </div>
              <div class="bg-gray-800/50 p-6 rounded-lg">
                <h3 class="text-xl font-semibold mb-3 text-white">Keep Favorites</h3>
                <p class="text-gray-300">Easily save and access your favorite images</p>
              </div>
              <div class="bg-gray-800/50 p-6 rounded-lg">
                <h3 class="text-xl font-semibold mb-3 text-white">High Resolution</h3>
                <p class="text-gray-300">Download images suitable for professional use</p>
              </div>
            </div>
          </section>

          <section class="mt-16 pt-12 border-t border-gray-700">
            <h2 class="text-3xl font-bold mb-8 text-center text-blue-300">Powered by Cutting-Edge AI</h2>
            <div class="flex justify-center items-center space-x-16">
              <a href="https://blackforestlabs.ai/" target="_blank" rel="noopener noreferrer" class="bg-white p-6 rounded-lg shadow-md transition-transform hover:scale-105">
                <img
                  src="/black-forest-labs-logo.png"
                  alt="Black Forest Labs Logo"
                  class="h-16 w-auto"
                />
              </a>
              <a href="https://www.together.ai" target="_blank" rel="noopener noreferrer" class="bg-white p-6 rounded-lg shadow-md transition-transform hover:scale-105">
                <img
                  src="/together-ai-logo.png"
                  alt="Together AI Logo"
                  class="h-16 w-auto"
                />
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
