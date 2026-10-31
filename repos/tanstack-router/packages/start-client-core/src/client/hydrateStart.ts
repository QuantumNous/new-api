import { hydrate } from '@tanstack/router-core/ssr/client'
import { startInstance } from '#tanstack-start-entry'
import {
  hasPluginAdapters,
  pluginSerializationAdapters,
} from '#tanstack-start-plugin-adapters'
import { getRouter } from '#tanstack-router-entry'
import { ServerFunctionSerializationAdapter } from './ServerFunctionSerializationAdapter'
import type { AnyRouter, AnySerializationAdapter } from '@tanstack/router-core'
import type { AnyStartInstanceOptions } from '../createStart'

type HotContext = {
  data?: Record<string, unknown>
  dispose?: (cb: (data: Record<string, unknown>) => void) => void
}

declare global {
  interface ImportMeta {
    hot?: HotContext
    webpackHot?: HotContext
  }
}

async function hydrateStart(): Promise<AnyRouter> {
  const router = await getRouter()

  let serializationAdapters: Array<AnySerializationAdapter>
  if (startInstance) {
    const startOptions = await startInstance.getOptions()
    startOptions.serializationAdapters =
      startOptions.serializationAdapters ?? []
    window.__TSS_START_OPTIONS__ = startOptions as AnyStartInstanceOptions
    serializationAdapters = startOptions.serializationAdapters
    router.options.defaultSsr = startOptions.defaultSsr
  } else {
    serializationAdapters = []
    window.__TSS_START_OPTIONS__ = {
      serializationAdapters,
    } as AnyStartInstanceOptions
  }

  // Only spread plugin adapters if any are configured (this will tree-shake away otherwise)
  if (hasPluginAdapters) {
    serializationAdapters.push(...pluginSerializationAdapters)
  }
  serializationAdapters.push(ServerFunctionSerializationAdapter)
  if (router.options.serializationAdapters) {
    serializationAdapters.push(...router.options.serializationAdapters)
  }

  router.update({
    basepath: process.env.TSS_ROUTER_BASEPATH,
    ...{ serializationAdapters },
  })
  if (!router.stores.matchesId.get().length) {
    await hydrate(router)
  }

  return router
}

function hydrateStartWithHmr(): Promise<AnyRouter> {
  const hot = import.meta.hot ?? import.meta.webpackHot

  if (!hot) {
    return hydrateStart()
  }

  const key = 'tss-hydrate-start-promise'
  const hotData = (hot.data ??= {})
  let hydrationPromise = hotData[key] as Promise<AnyRouter> | undefined

  if (!hydrationPromise) {
    hydrationPromise = hydrateStart().catch((error) => {
      if (hotData[key] === hydrationPromise) {
        hotData[key] = undefined
      }

      throw error
    })

    hotData[key] = hydrationPromise
  }

  hot.dispose?.((data) => {
    data[key] = hotData[key]
  })

  return hydrationPromise
}

const exportedHydrateStart =
  process.env.NODE_ENV !== 'production' ? hydrateStartWithHmr : hydrateStart

export { exportedHydrateStart as hydrateStart }
