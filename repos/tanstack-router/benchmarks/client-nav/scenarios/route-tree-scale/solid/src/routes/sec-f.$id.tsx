import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-f/$id')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return <div data-testid="scale-state">{`sec-f:${params().id}`}</div>
}
