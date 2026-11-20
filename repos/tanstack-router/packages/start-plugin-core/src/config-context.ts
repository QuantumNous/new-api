import {
  createNormalizedBasePaths,
  createNormalizedOutputDirectories,
  deriveRouterBasepath,
  resolveStartEntryPlan,
} from './planning'
import type { TanStackStartOutputConfig } from './schema'
import type {
  GetConfigFn,
  ResolvedStartConfig,
  TanStackStartCoreOptions,
} from './types'

export interface StartConfigContext {
  resolvedStartConfig: ResolvedStartConfig
  getConfig: GetConfigFn
  resolveEntries: () => ReturnType<typeof resolveStartEntryPlan>
}

export function createStartConfigContext<TInputConfig>(opts: {
  corePluginOpts: TanStackStartCoreOptions
  startPluginOpts: TInputConfig | undefined
  parseConfig: (
    opts: TInputConfig | undefined,
    core: { framework: TanStackStartCoreOptions['framework'] },
    root: string,
  ) => TanStackStartOutputConfig
}): StartConfigContext {
  const resolvedStartConfig: ResolvedStartConfig = {
    root: '',
    startFilePath: undefined,
    routerFilePath: '',
    srcDirectory: '',
    basePaths: {
      publicBase: '',
      assetBase: {
        dev: '',
        build: '',
      },
    },
    outputDirectories: {
      client: '',
      server: '',
    },
  }

  let startConfig: TanStackStartOutputConfig | null = null
  let resolvedEntryPlanCache:
    | ReturnType<typeof resolveStartEntryPlan>
    | undefined

  function requireRoot(): string {
    if (!resolvedStartConfig.root) {
      throw new Error(`Cannot get config before root is resolved`)
    }

    return resolvedStartConfig.root
  }

  function getStartConfig(): TanStackStartOutputConfig {
    if (!startConfig) {
      startConfig = opts.parseConfig(
        opts.startPluginOpts,
        { framework: opts.corePluginOpts.framework },
        requireRoot(),
      )
    }

    return startConfig
  }

  function getResolvedEntryPlan() {
    if (resolvedEntryPlanCache) {
      return resolvedEntryPlanCache
    }

    resolvedEntryPlanCache = resolveStartEntryPlan({
      root: requireRoot(),
      startConfig: getStartConfig(),
      defaultEntryPaths: opts.corePluginOpts.defaultEntryPaths,
    })

    Object.assign(resolvedStartConfig, {
      srcDirectory: resolvedEntryPlanCache.srcDirectory,
      startFilePath: resolvedEntryPlanCache.startFilePath,
      routerFilePath: resolvedEntryPlanCache.routerFilePath,
    })

    return resolvedEntryPlanCache
  }

  const getConfig: GetConfigFn = () => {
    const startConfig = getStartConfig()
    getResolvedEntryPlan()

    return { startConfig, resolvedStartConfig }
  }

  function resolveEntries() {
    return getResolvedEntryPlan()
  }

  return {
    resolvedStartConfig,
    getConfig,
    resolveEntries,
  }
}

export function applyResolvedBaseAndOutput(opts: {
  resolvedStartConfig: ResolvedStartConfig
  root: string
  publicBase: string
  clientOutputDirectory: string
  serverOutputDirectory: string
}): void {
  opts.resolvedStartConfig.root = opts.root
  opts.resolvedStartConfig.basePaths = createNormalizedBasePaths({
    publicBase: opts.publicBase,
  })
  opts.resolvedStartConfig.outputDirectories =
    createNormalizedOutputDirectories({
      client: opts.clientOutputDirectory,
      server: opts.serverOutputDirectory,
    })
}

export function applyResolvedRouterBasepath(opts: {
  resolvedStartConfig: ResolvedStartConfig
  startConfig: TanStackStartOutputConfig
}): string {
  const routerBasepath = deriveRouterBasepath({
    configuredBasepath: opts.startConfig.router.basepath,
    publicBase: opts.resolvedStartConfig.basePaths.publicBase,
  })
  opts.startConfig.router.basepath = routerBasepath
  return routerBasepath
}
