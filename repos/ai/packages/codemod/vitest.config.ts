import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['dist/**', 'node_modules/**'],
    // Codemod tests do CPU-heavy TypeScript syntax validation and can exceed
    // Vitest's default 5s timeout on saturated CI runners, especially in the
    // Node 24 matrix where the root test job runs many packages concurrently.
    // See https://github.com/vercel/ai/issues/15255.
    maxWorkers: process.env.CI ? 2 : undefined,
    testTimeout: process.env.CI ? 30_000 : 5_000,
  },
});
