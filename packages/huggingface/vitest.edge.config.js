import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'edge-runtime',
    globals: true,
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
