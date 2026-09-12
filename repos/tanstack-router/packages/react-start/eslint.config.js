// @ts-check

import pluginReact from '@eslint-react/eslint-plugin'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    ...pluginReact.configs.recommended,
    files: ['**/*.{ts,tsx}'],
  },
  {
    plugins: {
      'react-hooks': pluginReactHooks,
    },
    rules: {
      '@eslint-react/no-unstable-context-value': 'off',
      '@eslint-react/no-unstable-default-props': 'off',
      '@eslint-react/dom/no-missing-button-type': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
]
