import type { TanStackStartCoreOptions } from '../types'

export interface ViteRscForwardSsrResolverStrategy {
  type: 'vite-rsc-forward'
  sourceEnvironmentName: string
  sourceEntry: string
  exportName: 'getServerFnById'
}

export type SsrResolverStrategy =
  | { type: 'default' }
  | ViteRscForwardSsrResolverStrategy

export type TanStackStartVitePluginCoreOptions = TanStackStartCoreOptions & {
  providerEnvironmentName: string
  ssrIsProvider: boolean
  ssrResolverStrategy: SsrResolverStrategy
}
