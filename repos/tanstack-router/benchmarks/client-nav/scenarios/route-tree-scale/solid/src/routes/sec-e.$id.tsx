import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-e/$id')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return <div data-testid="scale-state">{`sec-e:${params().id}`}</div>
}
