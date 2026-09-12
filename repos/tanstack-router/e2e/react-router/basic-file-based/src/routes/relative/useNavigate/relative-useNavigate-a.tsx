import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/relative/useNavigate/relative-useNavigate-a',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="relative-useNavigate-a-header">
      Hello "/relative/useNavigate/relative-useNavigate-a"!
    </div>
  )
}
