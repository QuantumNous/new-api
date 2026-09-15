import { createFileRoute } from '@tanstack/react-router'
import { getServerClientHydrate } from '~/server/serverHydrateComponents'

export const Route = createFileRoute('/server-client')({
  loader: async () => ({
    Server: await getServerClientHydrate(),
  }),
  component: ServerClientRoute,
})

function ServerClientRoute() {
  const { Server } = Route.useLoaderData()
  return Server
}
