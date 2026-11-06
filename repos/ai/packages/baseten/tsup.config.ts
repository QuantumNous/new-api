import { defineConfig } from 'tsup';
import packageJson from './package.json';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
    },
  },
]);
