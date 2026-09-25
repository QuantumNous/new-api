import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts{,x}'],
    exclude: [
      '**/*.ui.test.ts{,x}',
      '**/*.e2e.test.ts{,x}',
      '**/node_modules/**',
    ],
    typecheck: {
      enabled: true,
    },
  },
});
