import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Base path for GitHub Pages deployment (repo name)
  base: '/semper-nexus/',
  root: '.',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'lib/*', dest: 'lib' },
        { src: 'app.js', dest: '' },
        { src: 'pwa-init.js', dest: '' },
        { src: 'service-worker.js', dest: '' },
        { src: 'semper-tokens.css', dest: '' },
        // Self-hosted web-vitals (Phase 1.3b - replaces unpkg CDN)
        { src: 'node_modules/web-vitals/dist/web-vitals.iife.js', dest: 'vendor' },
        // Self-hosted DOMPurify (Phase 5.1 - innerHTML sanitization)
        { src: 'node_modules/dompurify/dist/purify.min.js', dest: 'vendor' },
        // Self-hosted fontsource fonts (Phase 1.3c - replaces jsdelivr CDN)
        { src: 'node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2', dest: 'fonts' },
        { src: 'node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff', dest: 'fonts' },
        { src: 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', dest: 'fonts' },
        { src: 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-italic.woff2', dest: 'fonts' },
        { src: 'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', dest: 'fonts' }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        dead_code: true,
        unused: true
      },
      mangle: true
    },
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: {}
      }
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    sourcemap: false
  },
  server: {
    port: 8000,
    open: true,
    cors: true
  },
  preview: {
    port: 8080,
    open: true
  },
  optimizeDeps: {
    include: []
  }
});
