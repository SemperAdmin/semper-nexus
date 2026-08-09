import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Base path for GitHub Pages deployment (repo name)
  base: '/semper-nexus/',
  root: '.',
  plugins: [
    viteStaticCopy({
      targets: [
        // vite-plugin-static-copy v4 preserves the full source path under
        // dest; rename.stripBase / rename.name flatten each target back to
        // the layout index.html expects (lib/, vendor/, fonts/).
        { src: 'lib/*', dest: 'lib', rename: { stripBase: 1 } },
        { src: 'app.js', dest: '' },
        { src: 'pwa-init.js', dest: '' },
        { src: 'service-worker.js', dest: '' },
        { src: 'semper-tokens.css', dest: '' },
        // Self-hosted web-vitals and DOMPurify, sourced from node_modules so
        // package-lock.json stays the single source of truth. Copying from a
        // committed vendor/ directory instead would silently pin production to
        // a stale DOMPurify: a Dependabot security bump lands in node_modules
        // and never reaches the build.
        // Every deploy target must serve the build output, never the repo root.
        // safe-html.js fails closed when vendor/purify.min.js 404s, which
        // blanks every card and stat box.
        { src: 'node_modules/web-vitals/dist/web-vitals.iife.js', dest: 'vendor', rename: { stripBase: 3 } },
        { src: 'node_modules/dompurify/dist/purify.min.js', dest: 'vendor', rename: { stripBase: 3 } },
        // Self-hosted fontsource fonts (Phase 1.3c - replaces jsdelivr CDN)
        { src: 'node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2', dest: 'fonts', rename: { stripBase: 4 } },
        { src: 'node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff', dest: 'fonts', rename: { stripBase: 4 } },
        { src: 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', dest: 'fonts', rename: { stripBase: 4 } },
        { src: 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-italic.woff2', dest: 'fonts', rename: { stripBase: 4 } },
        { src: 'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', dest: 'fonts', rename: { stripBase: 4 } }
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
