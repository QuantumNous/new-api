import { initTRPC } from '@trpc/server'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'

const createTRPContext = ({ req, res }: CreateExpressContextOptions) => ({})

type TRPCContext = Awaited<ReturnType<typeof createTRPContext>>

const t = initTRPC.context<TRPCContext>().create()

const POSTS = [
  { id: '1', title: 'First post' },
  { id: '2', title: 'Second post' },
  { id: '3', title: 'Third post' },
  { id: '4', title: 'Fourth post' },
  { id: '5', title: 'Fifth post' },
  { id: '6', title: 'Sixth post' },
  { id: '7', title: 'Seventh post' },
  { id: '8', title: 'Eighth post' },
  { id: '9', title: 'Ninth post' },
  { id: '10', title: 'Tenth post' },
]

export const appRouter = t.router({
  hello: t.procedure.query(() => 'Hello world!'),
  posts: t.procedure.query(async (_) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return POSTS
  }),
  post: t.procedure.input(String).query(async (req) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return POSTS.find((p) => p.id === req.input)
  }),
})

export const trpcMiddleWare = createExpressMiddleware({
  router: appRouter,
  createContext: createTRPContext,
})

export type AppRouter = typeof appRouter
