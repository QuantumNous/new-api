import { fileURLToPath } from 'node:url'
import path from 'pathe'
import { createVirtualModule } from '@tanstack/start-plugin-core/vite'
import { createRscCssCompilerTransforms } from './rscCssTransform'
import type {
  TanStackStartVitePluginCoreOptions,
  ViteRscForwardSsrResolverStrategy,
} from '@tanstack/start-plugin-core/vite'
import type { PluginOption, UserConfig } from 'vite'

const isClientEnvironment = (env: { config: { consumer: string } }) =>
  env.config.consumer === 'client'

// Virtual module ids used by the React Start RSC runtime.
const RSC_HMR_VIRTUAL_ID = 'virtual:tanstack-rsc-hmr'
const RSC_RUNTIME_VIRTUAL_ID = 'virtual:tanstack-rsc-runtime'
const RSC_BROWSER_DECODE_VIRTUAL_ID = 'virtual:tanstack-rsc-browser-decode'
const RSC_SSR_DECODE_VIRTUAL_ID = 'virtual:tanstack-rsc-ssr-decode'
const RSC_ENV_NAME = 'rsc'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const entryDir = path.resolve(currentDir, '..', '..', 'plugin', 'entry')
const rscEntryPath = path.resolve(entryDir, 'rsc.tsx')

export function configureRsc(): {
  envName: string
  providerEnvironmentName: TanStackStartVitePluginCoreOptions['providerEnvironmentName']
  ssrResolverStrategy: TanStackStartVitePluginCoreOptions['ssrResolverStrategy']
  serializationAdapters: TanStackStartVitePluginCoreOptions['serializationAdapters']
  compilerTransforms: TanStackStartVitePluginCoreOptions['compilerTransforms']
} {
  const serializationAdapters: TanStackStartVitePluginCoreOptions['serializationAdapters'] =
    [
      // IMPORTANT: plugin-adapters-plugin only calls the top-level factory once.
      // That factory must return a flat array of adapters (not nested arrays),
      // otherwise router-core ends up with non-adapter entries and Seroval crashes.
      {
        client: {
          module: '@tanstack/react-start/rsc/serialization/client',
          export: 'rscSerializationAdapter',
          isFactory: true,
        },
        server: {
          module: '@tanstack/react-start/rsc/serialization/server',
          export: 'rscSerializationAdapter',
          isFactory: true,
        },
      },
    ]
  const ssrResolverStrategy = {
    type: 'vite-rsc-forward',
    sourceEnvironmentName: RSC_ENV_NAME,
    sourceEntry: 'index',
    exportName: 'getServerFnById',
  } satisfies ViteRscForwardSsrResolverStrategy
  return {
    envName: RSC_ENV_NAME,
    providerEnvironmentName: RSC_ENV_NAME,
    ssrResolverStrategy,
    serializationAdapters,
    compilerTransforms: createRscCssCompilerTransforms({
      loadCssExpression: 'import.meta.viteRsc.loadCss()',
    }),
  }
}
export function reactStartRscVitePlugin(): PluginOption {
  return [
    // When RSC is enabled, SSR needs noExternal: true to ensure single React instance.
    // The RSC decoder's dynamic imports for client components can cause module duplication
    // without this, leading to "Invalid hook call" errors.
    // We use the top-level `ssr` config option as `environments.ssr.resolve.noExternal`
    // doesn't have the same effect.
    {
      name: 'tanstack-react-start:rsc-ssr-config',
      config() {
        return {
          ssr: {
            noExternal: true,
          },
        }
      },
    },
    {
      name: 'tanstack-react-start:rsc-env-config',
      config() {
        return {
          rsc: {
            // Disable @vitejs/plugin-rsc's built-in server handler middleware.
            // TanStack Start has its own request handling via the SSR environment.
            serverHandler: false,
            // Disable CSS link precedence to prevent React 19 SSR suspension
            // TanStack Start handles CSS preloading via manifest injection instead
            cssLinkPrecedence: false,
          },
          environments: {
            [RSC_ENV_NAME]: {
              consumer: 'server',
              // Force @tanstack packages to be processed by Vite as source code
              // rather than treated as external modules. This ensures:
              // 1. createIsomorphicFn transforms are applied
              // 2. Imports are resolved within the RSC environment context
              //    with proper react-server conditions and pre-bundled deps
              resolve: {
                noExternal: [
                  '@tanstack/start**',
                  '@tanstack/react-start',
                  '@tanstack/react-start-rsc',
                  '@tanstack/react-router',
                ],
              },
              build: {
                rollupOptions: {
                  input: {
                    index: rscEntryPath,
                  },
                },
              },
            },
          },
        } satisfies UserConfig & {
          rsc: {
            serverHandler: false
            cssLinkPrecedence?: boolean
          }
        }
      },
    },

    {
      name: 'tanstack-react-start:rsc-scan-virtual-fallback',
      apply: 'build',
      applyToEnvironment(env) {
        return env.name === RSC_ENV_NAME
      },
      load: {
        filter: {
          id: /^(virtual:tanstack-rsc-runtime|virtual:vite-rsc\/encryption-key)$/,
        },
        handler(id) {
          if (this.environment.config.build.write !== false) return

          if (id === RSC_RUNTIME_VIRTUAL_ID) {
            return `export { renderToReadableStream, createFromReadableStream, createTemporaryReferenceSet, decodeReply, loadServerAction, decodeAction, decodeFormState } from '@vitejs/plugin-rsc/rsc'`
          }

          if (id === 'virtual:vite-rsc/encryption-key') {
            return `export default () => ''`
          }

          return undefined
        },
      },
    },

    // Runtime bridge into the Vite RSC environment.
    createVirtualModule({
      name: 'tanstack-react-start:rsc-runtime-virtual',
      moduleId: RSC_RUNTIME_VIRTUAL_ID,
      load() {
        const envName = this.environment.name
        if (envName === RSC_ENV_NAME) {
          return `export { renderToReadableStream, createFromReadableStream, createTemporaryReferenceSet, decodeReply, loadServerAction, decodeAction, decodeFormState } from '@vitejs/plugin-rsc/rsc'`
        }
        return `
export function renderToReadableStream() { throw new Error('renderToReadableStream can only be used in RSC environment'); }
export function createFromReadableStream() { throw new Error('createFromReadableStream can only be used in RSC environment'); }
export function createTemporaryReferenceSet() { throw new Error('createTemporaryReferenceSet can only be used in RSC environment'); }
export function decodeReply() { throw new Error('decodeReply can only be used in RSC environment'); }
export function loadServerAction() { throw new Error('loadServerAction can only be used in RSC environment'); }
export function decodeAction() { throw new Error('decodeAction can only be used in RSC environment'); }
export function decodeFormState() { throw new Error('decodeFormState can only be used in RSC environment'); }
`
      },
    }),
    createVirtualModule({
      name: 'tanstack-react-start:rsc-browser-decode-virtual',
      moduleId: RSC_BROWSER_DECODE_VIRTUAL_ID,
      load() {
        return `export { createFromReadableStream, createFromFetch } from '@vitejs/plugin-rsc/browser'`
      },
    }),
    createVirtualModule({
      name: 'tanstack-react-start:rsc-ssr-decode-virtual',
      moduleId: RSC_SSR_DECODE_VIRTUAL_ID,
      load() {
        return `export { setOnClientReference, createFromReadableStream } from '@vitejs/plugin-rsc/ssr'`
      },
    }),
    createVirtualModule({
      name: 'tanstack-react-start:rsc-hmr-virtual:dev',
      moduleId: RSC_HMR_VIRTUAL_ID,
      apply: 'serve',
      applyToEnvironment: isClientEnvironment,
      load() {
        return `
export function setupRscHmr() {
if (!import.meta.hot) {
  return
}

  let __invalidateQueued = false

  function __queueInvalidate() {
    if (__invalidateQueued) return
    __invalidateQueued = true
    queueMicrotask(async () => {
        __invalidateQueued = false
        try {
        const router = window.__TSR_ROUTER__
        if (!router) {
            console.warn('[rsc:hmr] No router found on window.__TSR_ROUTER__')
            return
        }
        await router.invalidate()
        } catch (e) {
        console.warn('[rsc:hmr] Failed to invalidate router:', e)
        }
    })
  }

  import.meta.hot.on('rsc:update', () => {
    __queueInvalidate()
  })
}
`
      },
    }),
    createVirtualModule({
      name: 'tanstack-react-start:rsc-hmr-virtual:prod',
      moduleId: RSC_HMR_VIRTUAL_ID,
      applyToEnvironment: isClientEnvironment,
      apply: 'build',
      load() {
        return 'export function setupRscHmr() {} '
      },
    }),
  ]
}
