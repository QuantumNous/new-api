import path from 'node:path'
import url from 'node:url'
import * as fs from 'node:fs'
import express from 'express'
import { trpcMiddleWare } from './trpc'

const PORT =
  typeof process.env.PORT !== 'undefined'
    ? parseInt(process.env.PORT, 10)
    : 3000
const HMR_PORT =
  typeof process.env.HMR_PORT !== 'undefined'
    ? parseInt(process.env.HMR_PORT, 10)
    : 3001

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const createServer = async (
  root = process.cwd(),
  isProd = process.env.NODE_ENV === 'production',
) => {
  const app = express()

  app.use('/trpc', trpcMiddleWare as any)

  if (!isProd) {
    const vite = await import('vite')
    const viteServer = await vite.createServer({
      root,
      logLevel: isTest ? 'error' : 'info',
      server: {
        middlewareMode: true,
        watch: {
          // During tests we edit the files too fast and sometimes chokidar
          // misses change events, so enforce polling for consistency
          usePolling: true,
          interval: 100,
        },
        hmr: {
          port: HMR_PORT,
        },
      },
      appType: 'custom',
    })

    // Use vite's connect instance as middleware
    app.use(viteServer.middlewares)

    // Handle any requests that don't match an API route by serving the React app's index.html
    app.get('/{*splat}', async (req, res, next) => {
      try {
        let html = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8')

        // Transform HTML using Vite plugins.
        html = await viteServer.transformIndexHtml(req.url, html)

        res.send(html)
      } catch (e) {
        return next(e)
      }
    })

    return { app }
  } else {
    app.use(express.static(path.resolve(__dirname, '../client')))

    // Handle any requests that don't match an API route by serving the React app's index.html
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.resolve(__dirname, '../client', 'index.html'))
    })
  }

  return { app }
}

if (!isTest) {
  createServer().then(({ app }) =>
    app.listen(PORT, (error) => {
      if (error) throw error
      console.info(`Server available at: http://localhost:${PORT}`)
    }),
  )
}
