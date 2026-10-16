import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  format: ['esm'],
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // external: [/node_modules/] // you can list external deps here if needed
});
