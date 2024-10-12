import { A } from '@solidjs/router';
import Footer from './Footer';

const HomePage = () => {
  return (
    <div class="page-transition flex flex-col min-h-screen">
      <main class="flex-grow flex items-center justify-center px-4 py-12">
        <div class="w-full max-w-4xl bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 overflow-hidden">
          <div class="p-8">
            <section class="text-center mb-12">
              <h1 class="text-5xl font-bold mb-4">AI-Powered Image Generation</h1>
              <p class="text-xl mb-8">Create stunning visuals with the power of artificial intelligence</p>
              <A
                href="/generate"
                class="inline-block px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Generating
              </A>
            </section>

            <section class="grid grid-cols-1 md:grid-cols-2 gap-12">
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
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
