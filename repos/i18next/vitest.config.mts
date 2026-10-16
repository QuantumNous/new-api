import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'runtime',
          dir: './test/runtime',
        },
      },
      {
        test: {
          name: 'compatibility',
          dir: './test/compatibility',
        },
      },
    ],
    coverage: {
      reporter: ['text', 'html', 'json', 'lcov'],
      include: ['**/src/*.js'],
      exclude: [
        '**/src/index.js',
        '**/src/shallowEqual.js',
        '**/node_modules/**',
        '**/test/**',
        '**/example/**',
      ],
    },
  },
});
