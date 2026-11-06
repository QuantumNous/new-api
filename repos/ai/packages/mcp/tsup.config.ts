import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
  },
  {
    entry: ['src/tool/mcp-stdio/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist/mcp-stdio',
  },
]);
