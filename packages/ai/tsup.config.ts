import { defineConfig } from 'tsup';

export default defineConfig([
  // Universal APIs
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    external: ['react', 'svelte', 'vue', 'chai', 'chai/*'],
    dts: true,
    sourcemap: true,
    target: 'es2018',
    platform: 'node',
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
  },
  // Internal APIs
  {
    entry: ['internal/index.ts'],
    outDir: 'dist/internal',
    format: ['esm'],
    external: ['chai', 'chai/*'],
    dts: true,
    sourcemap: true,
    target: 'es2018',
    platform: 'node',
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
  },
  // Test utilities
  {
    entry: ['test/index.ts'],
    outDir: 'dist/test',
    format: ['esm'],
    external: [
      'chai',
      'chai/*',
      'vitest',
      'vitest/*',
      '@vitest/*',
      'vitest/dist/*',
      'vitest/dist/chunks/*',
      'vitest/dist/node/*',
      'vitest/dist/node/chunks/*',
    ],
    dts: true,
    sourcemap: true,
    // Allow BigInt in tests
    target: 'es2020',
    platform: 'node',
    define: {
      __PACKAGE_VERSION__: JSON.stringify(
        (await import('./package.json', { with: { type: 'json' } })).default
          .version,
      ),
    },
  },
]);
