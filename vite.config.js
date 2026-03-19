import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

// SPA fallback plugin for /app/* routes in dev mode
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/app') && !req.url.includes('.')) {
          req.url = '/react-app.html';
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react({
      include: ['src/react/**/*.{jsx,tsx}']
    }),
    spaFallbackPlugin(),
    {
      name: 'tenant-html-transform',
      transformIndexHtml(html) {
        return html
          .replace(/__TENANT_PLATFORM_NAME__/g, process.env.VITE_TENANT_PLATFORM_NAME || 'Comunidad Social')
          .replace(/__TENANT_PLATFORM_SHORT_NAME__/g, process.env.VITE_TENANT_PLATFORM_SHORT_NAME || 'Comunidad Social')
          .replace(/__TENANT_COMMUNE__/g, process.env.VITE_TENANT_COMMUNE_NAME || '');
      }
    }
  ],
  resolve: {
    alias: {
      '@react': resolve(__dirname, 'src/react'),
      '@services': resolve(__dirname, 'src/services'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 3000,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        reactApp: resolve(__dirname, 'react-app.html')
      },
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // Heavy libraries in own chunks (no cross-deps with react core)
            if (id.includes('jspdf') || id.includes('jszip')) {
              return 'vendor-pdf';
            }
            if (id.includes('papaparse') || id.includes('xlsx')) {
              return 'vendor-import';
            }
            if (id.includes('qrcode') || id.includes('html5-qrcode')) {
              return 'vendor-qr';
            }
            // All other node_modules in one chunk to avoid circular deps
            return 'vendor';
          }

          // React page chunks for code splitting
          if (id.includes('src/react/pages/Admin/')) {
            return 'react-admin';
          }
          if (id.includes('src/react/pages/Wizard/')) {
            return 'react-wizard';
          }
          if (id.includes('src/react/pages/Ministro/')) {
            return 'react-ministro';
          }

          // Core React (shared components, stores, hooks, auth, member, org)
          if (id.includes('src/react/')) {
            return 'react-app';
          }

          if (id.includes('services/PDFService')) {
            return 'pdf-service';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  publicDir: 'public',
  optimizeDeps: {
    include: ['dompurify', 'jspdf', 'jszip', 'react', 'react-dom', 'react-router-dom', 'zustand'],
    exclude: []
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/']
    }
  }
});
