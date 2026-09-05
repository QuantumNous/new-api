import { getCheckedProperties } from './create-route-property-order.utils'

export const createRouteFunctionsIndirect = [
  'createFileRoute',
  'createRootRouteWithContext',
] as const
export const createRouteFunctionsDirect = [
  'createRootRoute',
  'createRoute',
] as const

export const createRouteFunctions = [
  ...createRouteFunctionsDirect,
  ...createRouteFunctionsIndirect,
] as const

export type CreateRouteFunction = (typeof createRouteFunctions)[number]

export const sortRules = [
  [['params', 'validateSearch'], ['search']],
  [['search'], ['loaderDeps', 'ssr']],
  [['loaderDeps'], ['context']],
  [['context'], ['beforeLoad']],
  [['beforeLoad'], ['loader']],
  [
    ['loader'],
    [
      'onEnter',
      'onStay',
      'onLeave',
      'head',
      'scripts',
      'headers',
      'remountDeps',
    ],
  ],
] as const

export type CheckedProperties = (typeof sortRules)[number][number][number]
export const checkedProperties = getCheckedProperties(sortRules)
