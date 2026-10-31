// @ts-check

import pluginSolid from 'eslint-plugin-solid/configs/typescript'
import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx}'],
    ...pluginSolid,
  },
]
