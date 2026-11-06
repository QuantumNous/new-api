import type { EnvironmentConfig } from '@rsbuild/core'
import type { TanStackStartCoreOptions } from '../types'

export interface RsbuildEnvironmentOverrides {
  all?: EnvironmentConfig | undefined
  client?: EnvironmentConfig | undefined
  server?: EnvironmentConfig | undefined
  provider?: EnvironmentConfig | undefined
}

export interface RsbuildCoreOptions {
  environments?: RsbuildEnvironmentOverrides | undefined
}

export type TanStackStartRsbuildPluginCoreOptions = TanStackStartCoreOptions & {
  providerEnvironmentName: string
  ssrIsProvider: boolean
  rsbuild?: RsbuildCoreOptions | undefined
  rsc?: boolean | undefined
}
