import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps the build portable: any static host, and later a Capacitor wrapper.
  base: './',
  // The dev server listens on this machine only; it is never exposed to the network.
  server: { port: 5173, strictPort: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
