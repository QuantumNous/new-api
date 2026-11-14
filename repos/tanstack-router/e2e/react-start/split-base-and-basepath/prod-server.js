import express from 'express'
import { toNodeHandler } from 'srvx/node'

const PORT = Number.parseInt(process.env.PORT || '3000')

const app = express()

const { default: handler } = await import('./dist/server/server.js')
const nodeHandler = toNodeHandler(handler.fetch)

// Serve built client assets at /_ui/ prefix
app.use('/_ui', express.static('dist/client'))

// All other requests go through the SSR handler
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
