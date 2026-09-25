import type { SerializationAdapterConfig } from './types'

export const EMPTY_SERIALIZATION_ADAPTERS_MODULE = `export const pluginSerializationAdapters = []
export const hasPluginAdapters = false`

interface ResolvedAdapterModule {
  module: string
  export: string
  isFactory: boolean
  index: number
}

export function resolveSerializationAdaptersForRuntime(opts: {
  adapters: Array<SerializationAdapterConfig> | undefined
  runtime: 'client' | 'server'
}): Array<ResolvedAdapterModule> {
  if (!opts.adapters?.length) {
    return []
  }

  const resolvedAdapters: Array<ResolvedAdapterModule> = []

  for (let i = 0; i < opts.adapters.length; i++) {
    const adapter = opts.adapters[i]!

    if ('module' in adapter) {
      resolvedAdapters.push({
        module: adapter.module,
        export: adapter.export,
        isFactory: adapter.isFactory ?? true,
        index: i,
      })
      continue
    }

    const runtimeAdapter =
      opts.runtime === 'client' ? adapter.client : adapter.server

    if (!runtimeAdapter) {
      continue
    }

    resolvedAdapters.push({
      module: runtimeAdapter.module,
      export: runtimeAdapter.export,
      isFactory: runtimeAdapter.isFactory ?? true,
      index: i,
    })
  }

  return resolvedAdapters
}

export function generateSerializationAdaptersModule(opts: {
  adapters: Array<SerializationAdapterConfig> | undefined
  runtime: 'client' | 'server'
}): string {
  const resolvedAdapters = resolveSerializationAdaptersForRuntime(opts)

  if (resolvedAdapters.length === 0) {
    return EMPTY_SERIALIZATION_ADAPTERS_MODULE
  }

  const imports = resolvedAdapters
    .map(
      (adapter) =>
        `import { ${adapter.export} as adapter${adapter.index} } from '${adapter.module}'`,
    )
    .join('\n')

  const items = resolvedAdapters
    .map((adapter) =>
      adapter.isFactory
        ? `...(Array.isArray(adapter${adapter.index}()) ? adapter${adapter.index}() : [adapter${adapter.index}()])`
        : `adapter${adapter.index}`,
    )
    .join(', ')

  return `${imports}
export const pluginSerializationAdapters = [${items}]
export const hasPluginAdapters = true`
}
