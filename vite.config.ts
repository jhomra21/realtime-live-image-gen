import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [solidPlugin()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  build: {
    assetsDir: 'assets', // This is where Vite will put processed assets
  },
  // Add this to ensure environment variables are loaded
  envPrefix: 'VITE_',
  define: {
    'process.env': process.env
  }
})
