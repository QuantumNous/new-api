export { configSchema, getConfig } from './core/config'
export { unpluginRouterCodeSplitterFactory } from './core/router-code-splitter-plugin'
export { unpluginRouterGeneratorFactory } from './core/router-generator-plugin'
export { createRouterPluginContext } from './core/router-plugin-context'
export type {
  Config,
  ConfigInput,
  ConfigOutput,
  CodeSplittingOptions,
  DeletableNodes,
  HmrOptions,
} from './core/config'
export type { RouterPluginContext } from './core/router-plugin-context'
export { getObjectPropertyKeyName } from './core/utils'
export type {
  ReferenceRouteCompilerPlugin,
  ReferenceRouteCompilerPluginContext,
} from './core/code-splitter/plugins'
export {
  tsrSplit,
  splitRouteIdentNodes,
  defaultCodeSplitGroupings,
} from './core/constants'
