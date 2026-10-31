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
    name: '@tanstack/eslint-plugin-router',
  },
  configs: {} as Plugin['configs'],
  rules,
}

// Assign configs here so we can reference `plugin`
Object.assign(plugin.configs, {
  recommended: {
    plugins: ['@tanstack/eslint-plugin-router'],
    rules: {
      '@tanstack/router/create-route-property-order': 'warn',
      '@tanstack/router/route-param-names': 'error',
    },
  },
  'flat/recommended': [
    {
      plugins: {
        '@tanstack/router': plugin,
      },
      rules: {
        '@tanstack/router/create-route-property-order': 'warn',
        '@tanstack/router/route-param-names': 'error',
      },
    },
  ],
})

export default plugin
