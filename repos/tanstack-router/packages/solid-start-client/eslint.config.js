// @ts-check

// import pluginReact from '@eslint-react/eslint-plugin'
// import pluginReactHooks from 'eslint-plugin-react-hooks'
import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    // ...pluginReact.configs.recommended,
    files: ['**/*.{ts,tsx}'],
  },
  {
    plugins: {
      // 'react-hooks': pluginReactHooks,
    },
    rules: {},
  },
  {
    files: ['**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
]
