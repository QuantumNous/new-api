import { joinPaths } from '@tanstack/router-core'
import { join } from 'pathe'
import { resolveEntry } from './resolve-entries'
import type { TanStackStartOutputConfig } from './schema'
import type {
  NormalizedBasePaths,
  NormalizedOutputDirectories,
  TanStackStartCoreOptions,
} from './types'

export interface ResolvedStartEntryPlan {
  srcDirectory: string
  startFilePath: string | undefined
  routerFilePath: string
  entryPaths: {
    client: string
    server: string
    start: string
    router: string
  }
}

export function normalizePublicBase(base: string | undefined): string {
  const resolvedBase = base ?? '/'

  if (isFullUrl(resolvedBase)) {
    return resolvedBase
  }

  return joinPaths(['/', resolvedBase, '/'])
}

export function deriveRouterBasepath(opts: {
  configuredBasepath: string | undefined
  publicBase: string
}): string {
  if (opts.configuredBasepath !== undefined) {
    return opts.configuredBasepath
  }

  if (isFullUrl(opts.publicBase)) {
    return '/'
  }

  return opts.publicBase.replace(/^\/|\/$/g, '')
}

export function shouldRewriteDevBasepath(opts: {
  command: 'serve' | 'build'
  middlewareMode: boolean | undefined
  routerBasepath: string
  publicBase: string
}): boolean {
  if (opts.command !== 'serve' || opts.middlewareMode) {
    return false
  }

  return !joinPaths(['/', opts.routerBasepath, '/']).startsWith(
    joinPaths(['/', opts.publicBase, '/']),
  )
}

export function createNormalizedBasePaths(opts: {
  publicBase: string
}): NormalizedBasePaths {
  return {
    publicBase: opts.publicBase,
    assetBase: {
      dev: opts.publicBase,
      build: opts.publicBase,
    },
  }
}

export function createNormalizedOutputDirectories(opts: {
  client: string
  server: string
}): NormalizedOutputDirectories {
  return {
    client: opts.client,
    server: opts.server,
  }
}

export function createServerFnBasePath(opts: {
  routerBasepath: string
  serverFnBase: string
}): string {
  return joinPaths(['/', opts.routerBasepath, opts.serverFnBase, '/'])
}

export function resolveStartEntryPlan(opts: {
  root: string
  startConfig: TanStackStartOutputConfig
  defaultEntryPaths: TanStackStartCoreOptions['defaultEntryPaths']
}): ResolvedStartEntryPlan {
  const srcDirectory = join(opts.root, opts.startConfig.srcDirectory)

  const startFilePath = resolveEntry({
    type: 'start entry',
    configuredEntry: opts.startConfig.start.entry,
    defaultEntry: 'start',
    resolvedSrcDirectory: srcDirectory,
    required: false,
  })

  const routerFilePath = resolveEntry({
    type: 'router entry',
    configuredEntry: opts.startConfig.router.entry,
    defaultEntry: 'router',
    resolvedSrcDirectory: srcDirectory,
    required: true,
  })

  const clientEntryPath = resolveEntry({
    type: 'client entry',
    configuredEntry: opts.startConfig.client.entry,
    defaultEntry: 'client',
    resolvedSrcDirectory: srcDirectory,
    required: false,
  })

  const serverEntryPath = resolveEntry({
    type: 'server entry',
    configuredEntry: opts.startConfig.server.entry,
    defaultEntry: 'server',
    resolvedSrcDirectory: srcDirectory,
    required: false,
  })

  return {
    srcDirectory,
    startFilePath,
    routerFilePath,
    entryPaths: {
      client: clientEntryPath ?? opts.defaultEntryPaths.client,
      server: serverEntryPath ?? opts.defaultEntryPaths.server,
      start: startFilePath ?? opts.defaultEntryPaths.start,
      router: routerFilePath,
    },
  }
}

function isFullUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}
