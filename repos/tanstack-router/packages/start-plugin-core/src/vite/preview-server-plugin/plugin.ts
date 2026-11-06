import { pathToFileURL } from 'node:url'
import { basename, extname, join } from 'pathe'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import { joinURL } from 'ufo'
import { VITE_ENVIRONMENT_NAMES } from '../../constants'
import { getServerOutputDirectory } from '../output-directory'
import { getBundlerOptions } from '../../utils'
import type { Plugin } from 'vite'

export function previewServerPlugin(): Plugin {
  return {
    name: 'tanstack-start-core:preview-server',
    configurePreviewServer: {
      // Run last so platform plugins (Cloudflare, Vercel, etc.) can register their handlers first
      order: 'post',
      handler(server) {
        // Return a function so Vite's internal middlewares (static files, etc.) handle requests first.
        // Our SSR handler only processes requests that nothing else handled.
        return () => {
          // Cache the server build to avoid re-importing on every request
          let serverBuild: any = null

          server.middlewares.use(async (req, res, next) => {
            try {
              // Lazy load server build on first request
              if (!serverBuild) {
                // Derive output filename from input
                const serverEnv =
                  server.config.environments[VITE_ENVIRONMENT_NAMES.server]
                const serverInput =
                  getBundlerOptions(serverEnv?.build)?.input ?? 'server'

                if (typeof serverInput !== 'string') {
                  throw new Error('Invalid server input. Expected a string.')
                }

                // Get basename without extension and add .js
                const outputFilename = `${basename(serverInput, extname(serverInput))}.js`
                const serverOutputDir = getServerOutputDirectory(server.config)
                const serverEntryPath = join(serverOutputDir, outputFilename)
                const imported = await import(
                  pathToFileURL(serverEntryPath).toString()
                )

                serverBuild = imported.default
              }

              // Prepend base path to request URL to match routing setup
              req.url = joinURL(server.config.base, req.url ?? '/')

              const webReq = new NodeRequest({ req, res })
              const webRes: Response = await serverBuild.fetch(webReq)

              if (webRes.headers.get('content-type')?.startsWith('text/html')) {
                res.setHeader('content-encoding', 'identity')
              }

              // Temporary workaround
              // Vite preview's compression middleware doesn't support flattened array headers that srvx sets
              // Call writeHead() before srvx to avoid corruption
              res.setHeaders(webRes.headers)
              res.writeHead(webRes.status, webRes.statusText)

              return sendNodeResponse(res, webRes)
            } catch (error) {
              next(error)
            }
          })
        }
      },
    },
  }
}
