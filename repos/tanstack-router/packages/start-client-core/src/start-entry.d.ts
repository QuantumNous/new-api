declare module '#tanstack-start-entry' {
  import type { StartEntry } from './startEntry'

  export const startInstance: StartEntry['startInstance']
}

declare module '#tanstack-router-entry' {
  import type { RouterEntry } from './startEntry'

  export const getRouter: RouterEntry['getRouter']
}

declare module '#tanstack-start-plugin-adapters' {
  import type { AnySerializationAdapter } from '@tanstack/router-core'

  export const pluginSerializationAdapters: Array<AnySerializationAdapter>
  export const hasPluginAdapters: boolean
}
