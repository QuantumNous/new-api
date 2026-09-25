// @ts-check

import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
]
