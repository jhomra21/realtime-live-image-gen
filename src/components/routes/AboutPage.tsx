import { Component } from 'solid-js';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

const AboutPage: Component = () => {
  return (
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
      <Card class="bg-gray-800/50 backdrop-blur-sm border-gray-700">
        <CardHeader>
          <h1 class="text-2xl font-bold text-center text-white">About</h1>
        </CardHeader>
        <CardContent>
          <div class="prose prose-invert max-w-none">
            <header class="text-center mb-12">
              <h1 class="text-4xl sm:text-5xl font-bold mb-4">About Real Time Image Generation</h1>
              <p class="text-lg sm:text-xl text-gray-300">Powered by Together AI and Black Forest Labs Flux Models</p>
            </header>

            <section class="space-y-10">
              <div>
                <h2 class="text-2xl sm:text-3xl font-bold mb-4 text-blue-300">Our Technology</h2>
                <p class="text-base sm:text-lg text-gray-300">
                  Our AI Image Generator leverages the cutting-edge capabilities of Together AI's infrastructure 
                  and the innovative Flux models from Black Forest Labs. This powerful combination allows us to 
                  offer state-of-the-art image generation with exceptional quality and speed.
                </p>
              </div>

              <div>
                <h2 class="text-2xl sm:text-3xl font-bold mb-4 text-blue-300">Together AI Integration</h2>
                <p class="text-base sm:text-lg text-gray-300">
                  Together AI provides us with a robust and scalable infrastructure for running AI models. Their 
                  platform enables us to deploy and manage our image generation models efficiently, ensuring high 
                  performance and reliability for our users.
                </p>
              </div>

              <div>
                <h2 class="text-2xl sm:text-3xl font-bold mb-4 text-blue-300">Black Forest Labs Flux Models</h2>
                <p class="text-base sm:text-lg text-gray-300">
                  We utilize the Flux models developed by Black Forest Labs, which are at the forefront of 
                  image generation technology. These models excel in creating high-quality, diverse images from 
                  textual descriptions, offering our users unparalleled creative possibilities.
                </p>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutPage;
