import express from 'express'
import { toNodeHandler } from 'srvx/node'
import type { NodeHttp1Handler } from 'srvx'

const DEVELOPMENT = process.env.NODE_ENV === 'development'
const PORT = Number.parseInt(process.env.PORT || '3000')

type FetchServerEntry = {
  default: { fetch: (req: Request) => Promise<Response> }
}

const app = express()

if (DEVELOPMENT) {
  // Set up rsbuild in middleware mode:
  // https://rsbuild.rs/config/server/middleware-mode
  const { createRsbuild, loadConfig } = await import('@rsbuild/core')
  const { content: userConfig } = await loadConfig({ cwd: process.cwd() })

  const rsbuild = await createRsbuild({
    rsbuildConfig: {
      ...userConfig,
      server: {
        ...(userConfig.server ?? {}),
        middlewareMode: true,
      },
    },
  })

  const devServer = await rsbuild.createDevServer()

  const serverEntry =
    await devServer.environments.ssr.loadBundle<FetchServerEntry>('index')
  const handler = toNodeHandler(serverEntry.default.fetch) as NodeHttp1Handler

  // Intercept server-fn URLs BEFORE rsbuild's built-in middlewares so they
  // don't get swallowed by htmlCompletion/assetsMiddleware — long base64
  // function IDs in the path can look like asset routes.
  app.use(async (req, res, next) => {
    if (!req.url.startsWith('/_serverFn')) return next()
    try {
      await handler(req, res)
    } catch (error) {
      next(error)
    }
  })

  // Rsbuild asset middlewares (JS/CSS/HMR).
  app.use(devServer.middlewares)

  // Catch-all SSR for page navigations.
  app.use(async (req, res, next) => {
    try {
      await handler(req, res)
    } catch (error) {
      next(error)
    }
  })

  const httpServer = app.listen(PORT, async (error) => {
    if (error) throw error
    await devServer.afterListen()
    console.log(`Server is running on http://localhost:${PORT}`)
  })
  devServer.connectWebSocket({ server: httpServer })
} else {
  const { default: handler } =
    (await import('./dist/server/index.js')) as FetchServerEntry
  const nodeHandler = toNodeHandler(handler.fetch) as NodeHttp1Handler
  app.use(express.static('dist/client'))
  app.use(async (req, res, next) => {
    try {
      await nodeHandler(req, res)
    } catch (error) {
      next(error)
    }
  })
  app.listen(PORT, (error) => {
    if (error) throw error
    console.log(`Server is running on http://localhost:${PORT}`)
  })
}
