import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-c/$id')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return <div data-testid="scale-state">{`sec-c:${params().id}`}</div>
}
