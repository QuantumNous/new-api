// @ts-check

import tsParser from '@typescript-eslint/parser'
import startPlugin from '@tanstack/eslint-plugin-start'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@tanstack/start': startPlugin,
    },
    rules: {
      '@tanstack/start/no-client-code-in-server-component': 'error',
      '@tanstack/start/no-async-client-component': 'error',
    },
  },
]
