import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  ignorePatterns: [
    // Avoid parser errors in intentionally invalid or unsupported fixtures.
    'e2e/cases/plugin-less/inline-js/src/*.less',
    'e2e/cases/browser-logs/skip-build-error/src/**',
    'e2e/cases/syntax-es/using-declaration/src/index.ts',
    // Preserve uppercase DOCTYPE in create-rsbuild templates.
    'packages/create-rsbuild/**/*.html',
  ],
});
