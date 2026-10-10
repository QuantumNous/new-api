import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
const version = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
).version;

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(version),
  },
});
