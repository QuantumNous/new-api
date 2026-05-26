import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const port = Number(process.env.PORT || 3014)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`)
  const decodedPath = decodeURIComponent(url.pathname)
  const requested = decodedPath === '/' ? '/index.html' : decodedPath
  const filePath = path.resolve(root, `.${requested}`)

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  const fileStat = await stat(filePath)
  if (fileStat.isDirectory()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'content-type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
  })
  createReadStream(filePath).pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(`aiapi114 static help center: http://localhost:${port}`)
})
