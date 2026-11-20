import type { ServerFn } from '../start-compiler/types'

export const SERVER_FN_BUILD_INFO_FIELD = 'tanstack.start.serverFns'
export const SERVER_FN_BUILD_INFO_CONTEXT_KEY =
  'tanstack.start.setServerFnBuildInfo'

export type ServerFnBuildInfo = {
  version: 1
  serverFnsById: Record<string, ServerFn>
}

export type SetServerFnBuildInfo = (metadata: ServerFnBuildInfo | null) => void

export type ServerFnBuildInfoLoaderContext = {
  [SERVER_FN_BUILD_INFO_CONTEXT_KEY]?: SetServerFnBuildInfo
}

export type ServerFnMetadataLoaderOptions = {
  metadataById: Map<string, ServerFnBuildInfo>
}
