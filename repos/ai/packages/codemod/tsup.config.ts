import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/bin/codemod.ts'],
    outDir: 'dist/bin',
    format: ['cjs'],
    dts: false,
    sourcemap: true,
  },
  {
    entry: ['src/codemods/**/*.ts'],
    outDir: 'dist/codemods',
    format: ['cjs'],
    dts: false,
    sourcemap: true,
  },
]);
