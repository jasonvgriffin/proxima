import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  worker: {
    // One classic script, inlined as a blob, so the packaged Electron file:// build
    // can start it under the sandbox without a second module URL.
    format: 'iife',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
