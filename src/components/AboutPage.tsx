import { A } from '@solidjs/router';
import Footer from './Footer';

const AboutPage = () => {
  return (
    <div class="page-transition">
      <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 overflow-hidden">
        <div class="p-8">
          <header class="text-center mb-12">
            <h1 class="text-5xl font-bold mb-4">About Our Project</h1>
            <p class="text-xl">Learn more about our AI-powered image generation technology</p>
          </header>

          <section class="space-y-8">
            <div>
              <h2 class="text-3xl font-bold mb-4 text-blue-300">Our Mission</h2>
              <p class="text-lg text-gray-300">
                At AI Image Generator, we're passionate about pushing the boundaries of artificial intelligence 
                and creativity. Our mission is to provide accessible, powerful tools that empower artists, 
                designers, and creators to bring their visions to life.
              </p>
            </div>

            <div>
              <h2 class="text-3xl font-bold mb-4 text-blue-300">The Technology</h2>
              <p class="text-lg text-gray-300">
                Our image generation system uses state-of-the-art machine learning models, trained on vast 
                datasets of images and text. By understanding the relationships between words and visual 
                elements, our AI can create unique, high-quality images based on textual descriptions.
              </p>
            </div>

            <div>
              <h2 class="text-3xl font-bold mb-4 text-blue-300">Our Team</h2>
              <p class="text-lg text-gray-300">
                As a solo developer, I'm passionate about leveraging cutting-edge AI technologies to push the 
                boundaries of digital creativity. By utilizing powerful GPU provider APIs, I've created a 
                platform that brings advanced image generation capabilities to artists and creators worldwide. 
                I'm committed to continually refining this technology and exploring new possibilities in 
                AI-generated art.
              </p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AboutPage;
