import { createIdFilter, resolveViteId } from '../utils'
import type { Plugin } from 'vite'

type VirtualModuleLoadHandler = (
  this: any,
  id: string,
) => string | null | undefined | Promise<string | null | undefined>

export function createVirtualModule(opts: {
  name: string
  moduleId: string
  load: VirtualModuleLoadHandler
  apply?: Plugin['apply']
  applyToEnvironment?: Plugin['applyToEnvironment']
  enforce?: Plugin['enforce']
  sharedDuringBuild?: boolean
}): Plugin {
  // Encode '#' as '%23' in the resolved ID to avoid browser treating it as URL fragment.
  // The browser requests /@id/__x00__%23tanstack-start-plugin-adapters instead of
  // /@id/__x00__#tanstack-start-plugin-adapters (which would truncate at #).
  const resolvedId = resolveViteId(opts.moduleId.replaceAll('#', '%23'))

  return {
    name: opts.name,
    apply: opts.apply,
    applyToEnvironment: opts.applyToEnvironment,
    enforce: opts.enforce,
    sharedDuringBuild: opts.sharedDuringBuild,
    resolveId: {
      filter: { id: createIdFilter([opts.moduleId]) },
      handler(id) {
        if (id === opts.moduleId) {
          return resolvedId
        }

        return undefined
      },
    },
    load: {
      filter: { id: createIdFilter([resolvedId]) },
      handler(id) {
        if (id !== resolvedId) {
          return undefined
        }

        return opts.load.call(this, id)
      },
    },
  }
}
