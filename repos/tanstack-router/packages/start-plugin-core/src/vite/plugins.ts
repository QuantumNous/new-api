import { normalizePath } from 'vite'
import { DEV_CLIENT_ENTRY } from '../constants'
import { createVirtualModule } from './createVirtualModule'
import type {
  CompileStartFrameworkOptions,
  GetConfigFn,
  ResolvedStartConfig,
} from '../types'
import type { PluginOption, ViteBuilder } from 'vite'

export function createDevClientEntryPlugin(opts: {
  framework: CompileStartFrameworkOptions
  getClientEntry: () => string
}): PluginOption {
  return createVirtualModule({
    name: 'tanstack-start-core:dev-client-entry',
    moduleId: DEV_CLIENT_ENTRY,
    enforce: 'pre',
    async load() {
      const clientEntry = JSON.stringify(
        normalizePath(opts.getClientEntry()).replaceAll('\\', '/'),
      )

      if (shouldInjectReactRefreshPreamble(this.environment, opts.framework)) {
        const reactRefresh = await this.resolve?.('/@react-refresh')

        if (!reactRefresh) {
          throw new Error(
            'TanStack Start React dev mode requires the React Refresh runtime, but /@react-refresh could not be resolved. Add @vitejs/plugin-react or another compatible React Refresh Vite plugin to your Vite config.',
          )
        }

        return (
          getReactRefreshPreambleCode(reactRefresh.id) +
          `\nawait import(${clientEntry})`
        )
      }

      return `import ${clientEntry}`
    },
  })
}

function shouldInjectReactRefreshPreamble(
  environment: ReactRefreshEnvironment | undefined,
  framework: CompileStartFrameworkOptions,
) {
  const config = environment?.config

  return (
    framework === 'react' &&
    config?.command === 'serve' &&
    config.consumer === 'client' &&
    config.server?.hmr !== false
  )
}

interface ReactRefreshEnvironment {
  config?: {
    command?: string
    consumer?: string
    server?: {
      hmr?: boolean
    }
  }
}

function getReactRefreshPreambleCode(reactRefreshId: string) {
  return `import { injectIntoGlobalHook } from ${JSON.stringify(reactRefreshId)};
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;`
}

export function createPostBuildPlugin(opts: {
  getConfig: GetConfigFn
  postServerBuild: (opts: {
    startConfig: ReturnType<GetConfigFn>['startConfig']
    builder: ViteBuilder
  }) => Promise<void>
}): PluginOption {
  return {
    name: 'tanstack-start-core:post-build',
    enforce: 'post',
    buildApp: {
      order: 'post',
      async handler(builder) {
        const { startConfig } = opts.getConfig()
        await opts.postServerBuild({ builder, startConfig })
      },
    },
  }
}

export function createDevBaseRewritePlugin(opts: {
  shouldRewriteDevBase: () => boolean
  resolvedStartConfig: ResolvedStartConfig
}): PluginOption {
  return {
    name: 'tanstack-start-core:dev-base-rewrite',
    configureServer(server) {
      if (!opts.shouldRewriteDevBase()) {
        return
      }

      const basePrefix = opts.resolvedStartConfig.basePaths.publicBase.replace(
        /\/$/,
        '',
      )

      server.middlewares.use((req, _res, next) => {
        if (req.url && !req.url.startsWith(basePrefix)) {
          req.url = basePrefix + req.url
        }

        next()
      })
    },
  }
}
