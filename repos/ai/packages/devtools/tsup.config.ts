import { defineConfig } from 'tsup';

export default defineConfig([
  // Middleware entry (main package export)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: false,
  },
  // Viewer server
  {
    entry: ['src/viewer/server.ts'],
    format: ['esm'],
    outDir: 'dist/viewer',
    clean: false,
  },
]);
