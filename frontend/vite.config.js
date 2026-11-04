import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    proxy: {
      '/projects': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/engine': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/components': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
      '/components/sushi': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    outDir: path.resolve(import.meta.dirname, '../web/public'),
    emptyOutDir: true,
  },
});