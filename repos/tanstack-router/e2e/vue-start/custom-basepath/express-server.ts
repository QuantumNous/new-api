import express from 'express'
import { toNodeHandler } from 'srvx/node'
import type { NodeHttp1Handler } from 'srvx'

const DEVELOPMENT = process.env.NODE_ENV === 'development'
const PORT = Number.parseInt(process.env.PORT || '3000')

const app = express()

if (DEVELOPMENT) {
  const viteDevServer = await import('vite').then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  )
  app.use(viteDevServer.middlewares)
  app.use(async (req, res, next) => {
    try {
      const { default: serverEntry } =
        await viteDevServer.ssrLoadModule('./src/server.ts')
      const handler = toNodeHandler(serverEntry.fetch) as NodeHttp1Handler
      await handler(req, res)
    } catch (error) {
      if (typeof error === 'object' && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error)
      }
      next(error)
    }
  })
} else {
  const { default: handler } = await import('./dist/server/server.js')
  const nodeHandler = toNodeHandler(handler.fetch) as NodeHttp1Handler
  app.use('/custom/basepath', express.static('dist/client'))
  app.use(async (req, res, next) => {
    try {
      await nodeHandler(req, res)
    } catch (error) {
      next(error)
    }
  })
}

app.listen(PORT, (error) => {
  if (error) throw error
  console.log(`Server is running on http://localhost:${PORT}`)
})
