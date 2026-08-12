import { createFileRoute } from '@tanstack/react-router'
import { getCssModuleHydrate } from '~/server/serverHydrateComponents'

export const Route = createFileRoute('/css')({
  loader: async () => ({
    Server: await getCssModuleHydrate(),
  }),
  component: CssRoute,
})

function CssRoute() {
  const { Server } = Route.useLoaderData()
  return Server
}
