import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-b/$id')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return <div data-testid="scale-state">{`sec-b:${params.id}`}</div>
}
