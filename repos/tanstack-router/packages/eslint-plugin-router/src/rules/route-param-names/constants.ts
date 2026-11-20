/**
 * Functions where the path is passed as the first argument (string literal)
 * e.g., createFileRoute('/path/$param')(...)
 */
export const pathAsFirstArgFunctions = [
  'createFileRoute',
  'createLazyFileRoute',
  'createLazyRoute',
] as const

export type PathAsFirstArgFunction = (typeof pathAsFirstArgFunctions)[number]

/**
 * Functions where the path is a property in the options object
 * e.g., createRoute({ path: '/path/$param' })
 */
export const pathAsPropertyFunctions = ['createRoute'] as const

export type PathAsPropertyFunction = (typeof pathAsPropertyFunctions)[number]

/**
 * All route functions that need param name validation
 */
export const allRouteFunctions = [
  ...pathAsFirstArgFunctions,
  ...pathAsPropertyFunctions,
] as const

export type RouteFunction = (typeof allRouteFunctions)[number]

/**
 * Regex for valid JavaScript identifier (param name)
 * Must start with letter, underscore, or dollar sign
 * Can contain letters, numbers, underscores, or dollar signs
 */
export const VALID_PARAM_NAME_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
