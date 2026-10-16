import { createMiddleware } from '@tanstack/react-start'

const preLogMiddleware = createMiddleware({ type: 'function' })
  .client(async (ctx) => {
    const clientTime = new Date()

    return ctx.next({
      context: {
        clientTime,
      },
      sendContext: {
        clientTime,
      },
    })
  })
  .server(async (ctx) => {
    const serverTime = new Date()

    return ctx.next({
      sendContext: {
        serverTime,
        durationToServer:
          serverTime.getTime() - ctx.context.clientTime.getTime(),
      },
    })
  })

export const logMiddleware = createMiddleware({ type: 'function' })
  .middleware([preLogMiddleware])
  .client(async (ctx) => {
    const res = await ctx.next()

    const now = new Date()
    console.log('Client Req/Res:', {
      duration: now.getTime() - res.context.clientTime.getTime(),
      durationToServer: res.context.durationToServer,
      durationFromServer: now.getTime() - res.context.serverTime.getTime(),
    })

    return res
  })
