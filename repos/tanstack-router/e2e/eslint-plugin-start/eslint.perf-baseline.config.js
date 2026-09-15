import * as tsParser from '@typescript-eslint/parser'

// Perf config: no rules enabled (baseline ESLint/TS overhead)
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
    plugins: {},
    rules: {},
  },
]
