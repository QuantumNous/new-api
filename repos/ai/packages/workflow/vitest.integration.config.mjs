import { defineConfig } from 'vitest/config';
import { workflow } from '@workflow/vitest';

export default defineConfig({
  plugins: [workflow()],
  test: {
    include: ['**/*.integration.test.ts'],
    testTimeout: 60_000, // Workflows may take longer than default timeout
  },
});
