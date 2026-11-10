import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /<repository-name>/ (P-2).
export default defineConfig({
  base: '/pointscape-3d/',
  plugins: [react(), tailwindcss()],
  build: {
    // three.js is about 560 kB on its own and cannot be made smaller. It gets its own file,
    // so an update to the game code does not make players download it again.
    chunkSizeWarningLimit: 620,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
