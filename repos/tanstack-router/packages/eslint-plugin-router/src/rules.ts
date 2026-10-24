import * as createRoutePropertyOrder from './rules/create-route-property-order/create-route-property-order.rule'
import * as routeParamNames from './rules/route-param-names/route-param-names.rule'
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
  [createRoutePropertyOrder.name]: createRoutePropertyOrder.rule,
  [routeParamNames.name]: routeParamNames.rule,
}
