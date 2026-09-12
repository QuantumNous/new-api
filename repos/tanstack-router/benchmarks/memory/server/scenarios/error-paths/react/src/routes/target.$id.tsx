import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/target/$id')({
  component: TargetComponent,
})

function TargetComponent() {
  const params = Route.useParams()

  return <main>{`target-${params.id}`}</main>
}
