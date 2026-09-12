import { toNodeHandler } from 'srvx/node'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

const port = process.env.PORT || 3000

const startPort = process.env.START_PORT || 3001

const isSpaMode = process.env.MODE === 'spa'
const isPrerender = process.env.MODE === 'prerender'
const distDir = process.env.E2E_DIST_DIR || 'dist'
const distClientDir = path.resolve(distDir, 'client')

function resolveDistServerEntryPath() {
  const serverJsPath = path.resolve(distDir, 'server', 'server.js')
  if (fs.existsSync(serverJsPath)) {
    return serverJsPath
  }

  const indexJsPath = path.resolve(distDir, 'server', 'index.js')
  if (fs.existsSync(indexJsPath)) {
    return indexJsPath
  }

  return serverJsPath
}

export async function createStartServer() {
  const distServerEntryPath = resolveDistServerEntryPath()
  const server = (await import(distServerEntryPath)).default
  const nodeHandler = toNodeHandler(server.fetch)

  const app = express()

  // to keep testing uniform stop express from redirecting /posts to /posts/
  // when serving pre-rendered pages
  app.use(express.static(distClientDir, { redirect: !isPrerender }))

  app.use(async (req, res, next) => {
    try {
      await nodeHandler(req, res)
    } catch (error) {
      next(error)
    }
  })

  return { app }
}

export async function createSpaServer() {
  const app = express()

  app.use(
    '/api',
    createProxyMiddleware({
      target: `http://localhost:${startPort}/api`, // Replace with your target server's URL
      changeOrigin: false, // Needed for virtual hosted sites,
    }),
  )

  app.use(
    '/_serverFn',
    createProxyMiddleware({
      target: `http://localhost:${startPort}/_serverFn`, // Replace with your target server's URL
      changeOrigin: false, // Needed for virtual hosted sites,
    }),
  )

  app.use(express.static(distClientDir))

  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.resolve(distClientDir, 'index.html'))
  })

  return { app }
}

if (isSpaMode) {
  createSpaServer().then(async ({ app }) =>
    app.listen(port, (error) => {
      if (error) throw error
      console.info(`Client Server: http://localhost:${port}`)
    }),
  )

  createStartServer().then(async ({ app }) =>
    app.listen(startPort, (error) => {
      if (error) throw error
      console.info(`Start Server: http://localhost:${startPort}`)
    }),
  )
} else {
  createStartServer().then(async ({ app }) =>
    app.listen(port, (error) => {
      if (error) throw error
      console.info(`Start Server: http://localhost:${port}`)
    }),
  )
}
