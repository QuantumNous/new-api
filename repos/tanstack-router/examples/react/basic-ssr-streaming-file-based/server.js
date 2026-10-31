import path from 'node:path'
import express from 'express'
import getPort, { portNumbers } from 'get-port'
import * as zlib from 'node:zlib'

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD

export async function createServer(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === 'production',
  hmrPort,
) {
  const app = express()

  /**
   * @type {import('vite').ViteDevServer}
   */
  let vite
  if (!isProd) {
    vite = await (
      await import('vite')
    ).createServer({
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
          port: hmrPort,
        },
      },
      appType: 'custom',
    })
    // use vite's connect instance as middleware
    app.use(vite.middlewares)
  } else {
    app.use(
      (await import('compression')).default({
        brotli: {
          flush: zlib.constants.BROTLI_OPERATION_FLUSH,
        },
        flush: zlib.constants.Z_SYNC_FLUSH,
      }),
    )
  }

  if (isProd) app.use(express.static('./dist/client'))

  app.use('/{*splat}', async (req, res) => {
    try {
      const url = req.originalUrl

      if (path.extname(url) !== '') {
        console.warn(`${url} is not valid router path`)
        res.status(404)
        res.end(`${url} is not valid router path`)
        return
      }

      // Best effort extraction of the head from vite's index transformation hook
      let viteHead = !isProd
        ? await vite.transformIndexHtml(
            url,
            `<html><head></head><body></body></html>`,
          )
        : ''

      viteHead = viteHead.substring(
        viteHead.indexOf('<head>') + 6,
        viteHead.indexOf('</head>'),
      )

      const entry = await (async () => {
        if (!isProd) {
          return vite.ssrLoadModule('/src/entry-server.tsx')
        } else {
          return import('./dist/server/entry-server.js')
        }
      })()

      console.info('Rendering: ', url, '...')
      entry.render({ req, res, head: viteHead })
    } catch (e) {
      !isProd && vite.ssrFixStacktrace(e)
      console.info(e.stack)
      res.status(500).end(e.stack)
    }
  })

  return { app, vite }
}

if (!isTest) {
  createServer().then(async ({ app }) =>
    app.listen(await getPort({ port: portNumbers(3000, 3100) }), (error) => {
      if (error) throw error
      console.info('Client Server: http://localhost:3000')
    }),
  )
}
