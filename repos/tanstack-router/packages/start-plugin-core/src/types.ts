import type * as babel from '@babel/core'
import type * as t from '@babel/types'
import type { GeneratorResult } from '@tanstack/router-utils'
import type { TanStackStartOutputConfig } from './schema'

export type CompileStartFrameworkOptions = 'react' | 'solid' | 'vue'

export type ServerFnLookupAccess = { origin: 'client' } | { origin: 'server' }

export type SerializationRuntime = 'client' | 'server'

export interface SerializationAdapterModuleRef {
  module: string
  export: string
  isFactory?: boolean
}

export type SerializationAdapterByRuntime = Partial<
  Record<SerializationRuntime, SerializationAdapterModuleRef>
>

export type SerializationAdapterConfig =
  | SerializationAdapterModuleRef
  | SerializationAdapterByRuntime

export type StartCompilerEnvironment = 'client' | 'server'

export interface StartCompilerImportTransformImport {
  libName: string
  rootExport: string
}

export interface StartCompilerTransformCandidate {
  path: babel.NodePath<t.CallExpression>
}

export interface StartCompilerTransformContext {
  readonly ast: t.File
  readonly code: string
  readonly id: string
  readonly env: StartCompilerEnvironment
  readonly envName: string
  readonly mode: 'dev' | 'build'
  readonly root: string
  readonly framework: CompileStartFrameworkOptions
  readonly providerEnvName: string
  readonly types: typeof t
  parseExpression: (code: string) => t.Expression
  warn?: (message: string) => void
}

export interface StartCompilerImportTransform {
  name: string
  environment?:
    | StartCompilerEnvironment
    | Array<StartCompilerEnvironment>
    | undefined
  imports: Array<StartCompilerImportTransformImport>
  detect: RegExp
  order?: 'pre' | 'post' | undefined
  transform: (
    candidates: Array<StartCompilerTransformCandidate>,
    context: StartCompilerTransformContext,
  ) => void
}

export interface StartCompilerTransformResult {
  code: string
  map?: GeneratorResult['map'] | null
}

export interface StartCompilerVirtualModuleContext {
  readonly id: string
  readonly root: string
  readonly env: StartCompilerEnvironment
  readonly envName: string
  readonly code?: string
}

export interface StartCompilerPlugin {
  name: string
  environment?:
    | StartCompilerEnvironment
    | Array<StartCompilerEnvironment>
    | undefined
  detect?: RegExp | undefined
  virtualModuleIdPattern?: RegExp | undefined
  transformAst?: (
    context: StartCompilerTransformContext,
  ) => boolean | null | undefined
  loadVirtualModule?: (
    context: StartCompilerVirtualModuleContext,
  ) => StartCompilerTransformResult | null
  invalidateModule?: (context: { id: string; envName: string }) => void
}

export interface NormalizedBasePaths {
  publicBase: string
  assetBase: {
    dev: string
    build: string
  }
}

export interface NormalizedOutputDirectories {
  client: string
  server: string
}

export interface NormalizedClientChunk {
  fileName: string
  isEntry: boolean
  imports: Array<string>
  dynamicImports: Array<string>
  css: Array<string>
  routeFilePaths: Array<string>
  hydrationIds: Array<string>
}

export interface NormalizedClientBuild {
  entryChunkFileName: string
  chunksByFileName: ReadonlyMap<string, NormalizedClientChunk>
  chunkFileNamesByRouteFilePath: ReadonlyMap<string, ReadonlyArray<string>>
  cssFilesBySourcePath: ReadonlyMap<string, ReadonlyArray<string>>
  cssContentByFileName?: ReadonlyMap<string, string>
}

export interface TanStackStartCoreOptions {
  framework: CompileStartFrameworkOptions
  defaultEntryPaths: {
    client: string
    server: string
    start: string
  }
  providerEnvironmentName: string
  ssrIsProvider: boolean
  serializationAdapters?: Array<SerializationAdapterConfig> | undefined
  compilerTransforms?: Array<StartCompilerImportTransform> | undefined
  serverFnProviderModuleDirectives?: ReadonlyArray<string> | undefined
}

export interface ResolvedStartConfig {
  root: string
  startFilePath: string | undefined
  routerFilePath: string
  srcDirectory: string
  basePaths: NormalizedBasePaths
  outputDirectories: NormalizedOutputDirectories
}

export type GetConfigFn = () => {
  startConfig: TanStackStartOutputConfig
  resolvedStartConfig: ResolvedStartConfig
}
