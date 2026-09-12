import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'runtime',
    dir: './test',
    exclude: ['**/typescript/**'],
    environment: 'happy-dom',
    setupFiles: ['./test/setup'],

    coverage: {
      reporter: ['text', 'html', 'json', 'lcov'],
      include: ['**/src/**/*.{js,jsx}', '*.macro.js'],
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
