import { createFileRoute } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { getCompositeHydrate } from '~/server/serverHydrateComponents'
import { DeferredHydrateIsland } from '~/components/DeferredHydrateIsland'

export const Route = createFileRoute('/composite')({
  loader: async () => ({
    Composite: await getCompositeHydrate(),
  }),
  component: CompositeRoute,
})

function CompositeRoute() {
  const { Composite } = Route.useLoaderData()
  return (
    <CompositeComponent src={Composite}>
      <DeferredHydrateIsland
        id="composite-interaction"
        title="Interaction strategy inside a composite server component"
        strategy="interaction"
      />
    </CompositeComponent>
  )
}
