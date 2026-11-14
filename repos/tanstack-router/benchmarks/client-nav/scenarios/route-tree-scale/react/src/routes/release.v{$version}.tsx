import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/release/v{$version}')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return <div data-testid="scale-state">{`release:${params.version}`}</div>
}
