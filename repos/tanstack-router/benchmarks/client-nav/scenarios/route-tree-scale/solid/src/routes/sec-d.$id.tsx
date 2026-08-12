import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-d/$id')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return <div data-testid="scale-state">{`sec-d:${params().id}`}</div>
}
