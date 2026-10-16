import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const version = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
).version;

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __PACKAGE_VERSION__: JSON.stringify(version),
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
