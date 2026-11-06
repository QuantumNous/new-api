import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from './server/trpc'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      // since we are using Vite, the server is running on the same port,
      // this means in dev the url is `http://localhost:3000/trpc`
      // and since its from the same origin, we don't need to explicitly set the full URL
      url: '/trpc',
    }),
  ],
})
