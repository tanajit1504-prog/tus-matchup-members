import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tus-matchup-members/',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'next/image': fileURLToPath(new URL('./src/next-image-shim.tsx', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-github',
    emptyOutDir: true,
  },
});
