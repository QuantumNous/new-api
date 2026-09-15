import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { toNodeHandler } from 'srvx/node'

const port = process.env.PORT || 3000
const distDir = process.env.E2E_DIST_DIR || 'dist-vite-ssr'
const distClientDir = path.resolve(distDir, 'client')

function resolveDistServerEntryPath() {
  const candidates = [
    path.resolve(distDir, 'server', 'server.js'),
    path.resolve(distDir, 'server', 'index.js'),
    path.resolve(distDir, 'server', 'index.mjs'),
  ]

  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
  )
}

async function createStartServer() {
  const server = (await import(resolveDistServerEntryPath())).default
  const nodeHandler = toNodeHandler(server.fetch)
  const app = express()

  app.use(express.static(distClientDir, { redirect: false }))
  app.use(async (req, res, next) => {
    try {
      await nodeHandler(req, res)
    } catch (error) {
      next(error)
    }
  })

  return app
}

createStartServer().then((app) => {
  app.listen(port, (error) => {
    if (error) throw error
    console.info(`Start Server: http://localhost:${port}`)
  })
})
