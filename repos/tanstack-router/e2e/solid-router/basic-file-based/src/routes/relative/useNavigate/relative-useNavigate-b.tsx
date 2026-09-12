import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute(
  '/relative/useNavigate/relative-useNavigate-b',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="relative-useNavigate-b-header">
      Hello "/relative/useNavigate/relative-useNavigate-b"!
    </div>
  )
}
