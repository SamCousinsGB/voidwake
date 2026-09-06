import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4176, strictPort: true },
  build: { outDir: 'dist-pages', emptyOutDir: true, sourcemap: false },
});
