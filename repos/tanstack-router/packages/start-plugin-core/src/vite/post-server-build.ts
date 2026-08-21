import { postBuild } from '../post-build'
import { getClientOutputDirectory } from './output-directory'
import { prerenderWithVite } from './prerender'
import type { TanStackStartOutputConfig } from '../schema'
import type { ViteBuilder } from 'vite'

export async function postServerBuild({
  builder,
  startConfig,
}: {
  builder: ViteBuilder
  startConfig: TanStackStartOutputConfig
}) {
  await postBuild({
    startConfig,
    adapter: {
      getClientOutputDirectory() {
        return getClientOutputDirectory(builder.config)
      },
      prerender(startConfig) {
        return prerenderWithVite({
          startConfig,
          builder,
        })
      },
    },
  })
}
