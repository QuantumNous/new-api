export const START_ENVIRONMENT_NAMES = {
  // 'ssr' is chosen as the name for the server environment to ensure backwards compatibility
  // with vite plugins that are not compatible with the new vite environment API (e.g. tailwindcss)
  server: 'ssr',
  client: 'client',
} as const

export type StartEnvironmentName =
  (typeof START_ENVIRONMENT_NAMES)[keyof typeof START_ENVIRONMENT_NAMES]

export const VITE_ENVIRONMENT_NAMES = START_ENVIRONMENT_NAMES

export type ViteEnvironmentNames = StartEnvironmentName

// for client and router:
// if a user has a custom server/client entry point file, resolve.alias will point to this
// otherwise it will be aliased to the default entry point in the respective framework plugin
export const ENTRY_POINTS = {
  client: 'virtual:tanstack-start-client-entry',
  server: 'virtual:tanstack-start-server-entry',
  // the start entry point must always be provided by the user
  start: '#tanstack-start-entry',
  router: '#tanstack-router-entry',
} as const

export const DEV_CLIENT_ENTRY = 'virtual:tanstack-start-dev-client-entry'

export const SERVER_FN_LOOKUP = 'server-fn-module-lookup'

// matches
// .ts, .tsx, .cts, .mts, .js, .jsx, .cjs, .mjs
// with optional query params after
// but not .json
export const TRANSFORM_ID_REGEX = [/\.[cm]?[tj]sx?($|\?)/]
