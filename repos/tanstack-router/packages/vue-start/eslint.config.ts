import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    ignores: ['bin/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: {},
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
]
