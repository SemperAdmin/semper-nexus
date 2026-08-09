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
        // Self-hosted web-vitals and DOMPurify. Committed under vendor/ so the
        // app also renders when the repository root is served directly (any
        // static host without a build step): safe-html.js fails closed when
        // vendor/purify.min.js 404s, which blanks every card and stat box.
        // Refresh the committed copies with: npm run update-vendor
        { src: 'vendor/*', dest: 'vendor' },
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
