import solidPlugin from 'vite-plugin-solid'
import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    ignores: ['bin/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: {
      solidPlugin: solidPlugin(),
    },
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
]
