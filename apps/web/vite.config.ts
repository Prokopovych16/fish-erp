import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // щоб імпортувати як @/components замість ../../components
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // проксіюємо API запити щоб уникнути CORS в розробці
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});