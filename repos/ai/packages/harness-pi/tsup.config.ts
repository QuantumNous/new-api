import { defineConfig } from 'tsup';

const packageVersion = JSON.stringify(
  (await import('./package.json', { with: { type: 'json' } })).default.version,
);

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  define: {
    __PACKAGE_VERSION__: packageVersion,
  },
});
