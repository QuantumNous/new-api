import { rules } from './rules'
import type { ESLint, Linter } from 'eslint'
import type { RuleModule } from '@typescript-eslint/utils/ts-eslint'

type RuleKey = keyof typeof rules

interface Plugin extends Omit<ESLint.Plugin, 'rules'> {
  rules: Record<RuleKey, RuleModule<any, any, any>>
  configs: {
    recommended: ESLint.ConfigData
    'flat/recommended': Array<Linter.FlatConfig>
  }
}

const plugin: Plugin = {
  meta: {
    name: '@tanstack/eslint-plugin-start',
  },
  configs: {} as Plugin['configs'],
  rules,
}

// Assign configs here so we can reference `plugin`
Object.assign(plugin.configs, {
  recommended: {
    plugins: ['@tanstack/eslint-plugin-start'],
    rules: {
      '@tanstack/start/no-client-code-in-server-component': 'error',
      '@tanstack/start/no-async-client-component': 'error',
    },
  },
  'flat/recommended': [
    {
      plugins: {
        '@tanstack/start': plugin,
      },
      rules: {
        '@tanstack/start/no-client-code-in-server-component': 'error',
        '@tanstack/start/no-async-client-component': 'error',
      },
    },
  ],
})

export default plugin
