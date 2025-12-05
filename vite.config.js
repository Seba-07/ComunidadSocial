import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
        ministroDashboard: resolve(__dirname, 'ministro-dashboard.html'),
        ministroLogin: resolve(__dirname, 'ministro-login.html')
      },
      output: {
        manualChunks: undefined
      }
    }
  },
  publicDir: 'public'
});
