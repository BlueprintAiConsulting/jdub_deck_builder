import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost',
    open: false,
  },
  build: {
    // Inline everything for file:// compatibility
    assetsInlineLimit: 999999999,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  // Use relative paths so file:// works
  base: './',
});
