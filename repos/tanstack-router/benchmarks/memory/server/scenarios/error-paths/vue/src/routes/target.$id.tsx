import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/target/$id')({
  component: TargetComponent,
})

function TargetComponent() {
  const params = Route.useParams()

  return <main>{`target-${params.value.id}`}</main>
}
