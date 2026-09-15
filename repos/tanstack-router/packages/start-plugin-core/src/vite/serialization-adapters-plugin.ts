import { VIRTUAL_MODULES } from '@tanstack/start-server-core'
import { generateSerializationAdaptersModule } from '../serialization-adapters-module'
import { START_ENVIRONMENT_NAMES } from '../constants'
import { createIdFilter } from '../utils'
import type { SerializationAdapterConfig } from '../types'
import type { PluginOption } from 'vite'

const CLIENT_MODULE_ID = 'virtual:tanstack-start-plugin-adapters/client'
const SERVER_MODULE_ID = 'virtual:tanstack-start-plugin-adapters/server'
const BUILD_CLIENT_MODULE_ID = `\0${CLIENT_MODULE_ID}`
const BUILD_SERVER_MODULE_ID = `\0${SERVER_MODULE_ID}`
const MODULE_IDS = [
  CLIENT_MODULE_ID,
  SERVER_MODULE_ID,
  BUILD_CLIENT_MODULE_ID,
  BUILD_SERVER_MODULE_ID,
]

const moduleIdFilter = createIdFilter(MODULE_IDS)
const resolveIdFilter = createIdFilter([
  VIRTUAL_MODULES.pluginAdapters,
  ...MODULE_IDS,
])

export function serializationAdaptersPlugin(opts: {
  adapters: Array<SerializationAdapterConfig> | undefined
}): PluginOption {
  return {
    name: 'tanstack-start:plugin-adapters',
    enforce: 'pre',
    resolveId: {
      filter: { id: resolveIdFilter },
      handler(id) {
        if (getRuntime(id)) {
          return id
        }

        if (id !== VIRTUAL_MODULES.pluginAdapters) {
          return undefined
        }

        const runtime =
          this.environment.name === START_ENVIRONMENT_NAMES.client
            ? 'client'
            : 'server'

        return getModuleId(runtime, this.environment.config.command)
      },
    },
    load: {
      filter: { id: moduleIdFilter },
      handler(id) {
        const runtime = getRuntime(id)
        if (!runtime) {
          return undefined
        }

        return generateSerializationAdaptersModule({
          adapters: opts.adapters,
          runtime,
        })
      },
    },
  }
}

function getModuleId(runtime: 'client' | 'server', command: string) {
  if (runtime === 'client') {
    return command === 'serve' ? CLIENT_MODULE_ID : BUILD_CLIENT_MODULE_ID
  }

  return command === 'serve' ? SERVER_MODULE_ID : BUILD_SERVER_MODULE_ID
}

function getRuntime(id: string): 'client' | 'server' | undefined {
  switch (id) {
    case CLIENT_MODULE_ID:
    case BUILD_CLIENT_MODULE_ID:
      return 'client'
    case SERVER_MODULE_ID:
    case BUILD_SERVER_MODULE_ID:
      return 'server'
    default:
      return undefined
  }
}
