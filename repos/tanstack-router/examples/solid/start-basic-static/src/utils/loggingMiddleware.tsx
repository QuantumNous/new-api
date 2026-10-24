import { createMiddleware } from '@tanstack/solid-start'

export const logMiddleware = createMiddleware({ type: 'function' })
  .middleware([
    createMiddleware({ type: 'function' })
      .client(async (ctx) => {
        const clientTime = new Date()

        return await ctx.next({
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

        return await ctx.next({
          sendContext: {
            serverTime,
            durationToServer:
              serverTime.getTime() - ctx.context.clientTime.getTime(),
          },
        })
      }),
  ])
  .client(async (options) => {
    const result = await options.next()

    const now = new Date()

    console.log('Client Req/Res:', {
      duration: result.context.clientTime.getTime() - now.getTime(),
      durationToServer: result.context.durationToServer,
      durationFromServer: now.getTime() - result.context.serverTime.getTime(),
    })

    return result
  })
