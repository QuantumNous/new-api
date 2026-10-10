import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/relative/link/relative-link-a')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="relative-link-a-header">
      Hello "/relative/link/relative-link-a"!
    </div>
  )
}
