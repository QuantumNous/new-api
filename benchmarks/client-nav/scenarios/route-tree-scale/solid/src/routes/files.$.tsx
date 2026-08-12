import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/files/$')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return <div data-testid="scale-state">{`files:${params()._splat}`}</div>
}
