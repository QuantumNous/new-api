import http from 'node:http'
import { posts } from './posts'
import { users } from './users'

// some tests redirect to an external host
// however, in CI this is unstable due to network conditions
// so here we spawn a local server to simulate the external host

export async function localDummyServer(port: number) {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Request-Method', '*')
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST')
    res.setHeader('Access-Control-Allow-Headers', '*')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }
  })

  server.on('request', (req, res) => {
    const url = new URL(req.url!, 'http://localhost')

    if (res.req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('Hello World')
    }
  })

  server.on('request', (req, res) => {
    const url = new URL(req.url!, `http://localhost`)

    if (res.req.method === 'POST' && url.pathname === '/stop') {
      server.close()
      console.info(
        `stopped local dummy server running at http://localhost:${port}`,
      )

      res.writeHead(200)
      res.end()
    }
  })

  server.on('request', (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost`)

    if (req.method === 'GET' && url.pathname.startsWith('/posts')) {
      const parts = url.pathname.split('/')

      if (parts.length === 2) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(posts))
        return
      }

      if (parts[2]) {
        const postId = parseInt(parts[2])

        if (isNaN(postId)) {
          res.writeHead(404)
          res.end(JSON.stringify({ error: 'invalid post id' }))
          return
        }

        const post = posts.find((post) => post.id === postId)

        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(post))
        return
      }

      res.writeHead(404)
      res.end(JSON.stringify({ error: 'invalid posts path' }))
      return
    }
  })

  server.on('request', (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost`)

    if (req.method === 'GET' && url.pathname.startsWith('/users')) {
      const parts = url.pathname.split('/')

      if (parts.length === 2) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(users))
        return
      }

      if (parts[2]) {
        const userId = parseInt(parts[2])

        if (isNaN(userId)) {
          res.writeHead(404)
          res.end(JSON.stringify({ error: 'invalid user id' }))
          return
        }

        const user = users.find((user) => user.id === userId)

        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(user))
        return
      }

      res.writeHead(404)
      res.end(JSON.stringify({ error: 'invalid users path' }))
      return
    }
  })

  const startServer = new Promise<void>((resolve) => {
    server.listen(port, 'localhost', () => {
      console.info(
        `started local dummy server running at http://localhost:${port}`,
      )
      resolve()
    })
  })

  await startServer

  await new Promise((r) => setTimeout(r, 500))
  return server
}
