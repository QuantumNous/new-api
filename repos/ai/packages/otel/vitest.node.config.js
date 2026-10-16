import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  define: {
    __PACKAGE_VERSION__: JSON.stringify('0.0.0-test'),
  },

  // the `resolve alias` is needed to mock the ai package version in tests - for user-agent span in telemetry
  resolve: {
    alias: {
      'ai/test': path.resolve(__dirname, '../ai/test/index.ts'),
      ai: path.resolve(__dirname, '../ai/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts{,x}'],
    exclude: ['**/node_modules/**'],
  },
});
