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
    // Optimizaciones de minificación
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Eliminar console.log en producción
        drop_debugger: true
      }
    },
    // Reportar tamaño de chunks
    reportCompressedSize: true,
    // Límite de advertencia para chunks grandes (500KB)
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
        ministroDashboard: resolve(__dirname, 'ministro-dashboard.html'),
        ministroLogin: resolve(__dirname, 'ministro-login.html')
      },
      output: {
        // ============ CODE SPLITTING OPTIMIZADO ============
        manualChunks: (id) => {
          // Vendor chunks - librerías externas
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('jszip')) {
              return 'vendor-pdf';  // ~200KB - solo carga cuando genera PDFs
            }
            if (id.includes('dompurify')) {
              return 'vendor-security';  // ~20KB
            }
            return 'vendor';  // Resto de node_modules
          }

          // Feature chunks - módulos grandes del proyecto
          if (id.includes('presentation/admin/')) {
            return 'admin';  // ~300KB - solo para administradores
          }
          if (id.includes('presentation/components/wizard/')) {
            return 'wizard';  // ~380KB - solo cuando crea organización
          }
          if (id.includes('presentation/ministro/')) {
            return 'ministro';  // ~120KB - solo para ministros
          }
          if (id.includes('services/PDFService')) {
            return 'pdf-service';  // Junto con vendor-pdf
          }
        },
        // Nombres de archivo con hash para cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  publicDir: 'public',
  // Optimizar dependencias
  optimizeDeps: {
    include: ['dompurify', 'jspdf', 'jszip'],
    exclude: []  // firebase removido
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
