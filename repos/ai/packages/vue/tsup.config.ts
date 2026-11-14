import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    banner: {},
    format: ['esm'],
    external: ['vue'],
    dts: true,
    sourcemap: true,
  },
]);
