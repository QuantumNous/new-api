import * as tsParser from '@typescript-eslint/parser'
import startPlugin from '@tanstack/eslint-plugin-start'

// Perf config: only no-client-code-in-server-component rule
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@tanstack/start': startPlugin,
    },
    rules: {
      '@tanstack/start/no-client-code-in-server-component': 'error',
    },
  },
]
