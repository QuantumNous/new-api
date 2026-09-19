import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const version = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
).version;

export function createVitestConfig(environment) {
  return defineConfig({
    define: {
      __PACKAGE_VERSION__: JSON.stringify(version),
    },
    test: {
      environment,
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
}
