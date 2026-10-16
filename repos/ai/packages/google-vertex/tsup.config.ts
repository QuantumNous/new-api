import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist',
  },
  {
    entry: ['src/edge/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist/edge',
  },
  {
    entry: ['src/anthropic/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist/anthropic',
  },
  {
    entry: ['src/anthropic/edge/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist/anthropic/edge',
  },
  {
    entry: ['src/maas/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist/maas',
  },
  {
    entry: ['src/maas/edge/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist/maas/edge',
  },
  {
    entry: ['src/xai/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist/xai',
  },
  {
    entry: ['src/xai/edge/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
    outDir: 'dist/xai/edge',
  },
]);
