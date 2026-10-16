import { createFileRoute } from '@tanstack/react-router'
import { getNodeModuleClientServerComponent } from '~/utils/nodeModuleClientServerComponent'

export const Route = createFileRoute('/rsc-node-module-client')({
  loader: async () => {
    const Server = await getNodeModuleClientServerComponent()
    return { Server }
  },
  component: RscNodeModuleClientComponent,
})

function RscNodeModuleClientComponent() {
  const { Server } = Route.useLoaderData()

  return (
    <main>
      <h1 data-testid="rsc-node-module-client-title">
        RSC node_modules client component
      </h1>
      {Server}
    </main>
  )
}
