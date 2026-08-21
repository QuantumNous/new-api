import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/relative/link/relative-link-b')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="relative-link-b-header">
      Hello "/relative/link/relative-link-b"!
    </div>
  )
}
