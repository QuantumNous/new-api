import { SERVER_FN_BUILD_INFO_CONTEXT_KEY } from './start-compiler-metadata'
import type { Rspack } from '@rsbuild/core'
import type {
  ServerFnBuildInfoLoaderContext,
  ServerFnMetadataLoaderOptions,
} from './start-compiler-metadata'

const tanStackStartCompilerMetadataLoader: Rspack.LoaderDefinition<
  ServerFnMetadataLoaderOptions,
  ServerFnBuildInfoLoaderContext
> = function (source, map): void {
  const { metadataById } = this.getOptions()
  const id = this.resource
  const metadata = metadataById.get(id)
  const setBuildInfo = this[SERVER_FN_BUILD_INFO_CONTEXT_KEY]

  setBuildInfo?.(metadata ?? null)

  this.callback(null, source, map)
}

export default tanStackStartCompilerMetadataLoader
