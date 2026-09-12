// @ts-check

import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx}'],
  },
  {
    plugins: {},
    rules: {},
  },
]
