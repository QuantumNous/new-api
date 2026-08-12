import { createStart } from '@tanstack/react-start'

export const startInstance = createStart(() => {})

export const serverFnMw = startInstance
  .createMiddleware({ type: 'function' })
  .server(({ next }) => {
    console.log('server mw')
    return next({
      context: { admin: 'admin' },
    })
  })
  .client(({ next }) => {
    console.log('client mw')
    return next()
  })

export const requestMw = startInstance
  .createMiddleware({ type: 'request' })
  .server(({ next }) => {
    return next({
      context: { requestMw: 'yes' },
    })
  })
