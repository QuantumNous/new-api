import * as esbuild from 'esbuild'
import http from 'node:http'
import { createReadStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import esbuildConfig from './esbuild.config.js'

const args = process.argv.slice(2)
const command = args[0] ?? 'build'

function getArgValue(name) {
  const idx = args.indexOf(name)
  if (idx === -1) return
  return args[idx + 1]
}

function getPort() {
  const fromArg = getArgValue('--port')
  const fromEnv = process.env.VITE_SERVER_PORT
  const port = Number(fromArg ?? fromEnv ?? 5601)
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid port: ${String(fromArg ?? fromEnv)}`)
  }
  return port
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.map':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    case '.woff':
      return 'font/woff'
    case '.woff2':
      return 'font/woff2'
    case '.ttf':
      return 'font/ttf'
    default:
      return 'application/octet-stream'
  }
}

async function fileExists(filePath) {
  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

async function buildOnce() {
  const entry = path.join(process.cwd(), 'src/main.tsx')
  const outfile = path.join(process.cwd(), 'dist/main.js')
  const inject = [path.join(process.cwd(), 'src/jsx-shim.ts')]

  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    platform: 'browser',
    format: 'esm',
    jsx: 'transform',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    inject,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.VITE_NODE_ENV ?? process.env.NODE_ENV ?? 'development',
      ),
    },
    ...esbuildConfig,
  })
}

function startStaticServer({ port }) {
  const rootDir = process.cwd()
  const indexPath = path.join(rootDir, 'index.html')

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`,
      )
      const requestPath = decodeURIComponent(url.pathname)

      const normalizedPath = path.posix
        .normalize(requestPath)
        .replace(/^(\.\.(\/|\\|$))+/, '')
        .replace(/^\/+/, '')

      const filePath = path.join(rootDir, normalizedPath)

      const hasExtension = path.posix.basename(normalizedPath).includes('.')

      const servedPath =
        (await fileExists(filePath)) && !(await fs.stat(filePath)).isDirectory()
          ? filePath
          : !hasExtension
            ? indexPath
            : undefined

      if (!servedPath) {
        res.statusCode = 404
        res.end('Not found')
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', getMimeType(servedPath))
      createReadStream(servedPath).pipe(res)
    } catch (err) {
      res.statusCode = 500
      res.end(String(err))
    }
  })

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`http://localhost:${port}`)
      resolve(server)
    })
  })
}

async function main() {
  if (command === 'build') {
    await buildOnce()
    return
  }

  if (command === 'preview') {
    const port = getPort()
    await startStaticServer({ port })
    return
  }

  if (command === 'dev') {
    const port = getPort()
    const inject = [path.join(process.cwd(), 'src/jsx-shim.ts')]
    const ctx = await esbuild.context({
      entryPoints: [path.join(process.cwd(), 'src/main.tsx')],
      bundle: true,
      outfile: path.join(process.cwd(), 'dist/main.js'),
      platform: 'browser',
      format: 'esm',
      jsx: 'transform',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      inject,
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          process.env.VITE_NODE_ENV ?? process.env.NODE_ENV ?? 'development',
        ),
      },
      ...esbuildConfig,
    })

    await ctx.watch()
    await startStaticServer({ port })
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
