import * as noClientCodeInServerComponent from './rules/no-client-code-in-server-component/no-client-code-in-server-component.rule'
import * as noAsyncClientComponent from './rules/no-async-client-component/no-async-client-component.rule'
import type { ESLintUtils } from '@typescript-eslint/utils'
import type { ExtraRuleDocs } from './types'

export const rules: Record<
  string,
  ESLintUtils.RuleModule<
    string,
    ReadonlyArray<unknown>,
    ExtraRuleDocs,
    ESLintUtils.RuleListener
  >
> = {
  [noClientCodeInServerComponent.name]: noClientCodeInServerComponent.rule,
  [noAsyncClientComponent.name]: noAsyncClientComponent.rule,
}
