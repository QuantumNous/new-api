import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/relative/useNavigate/nested/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="relative-useNavigate-nested-header">
      Hello "/relative/useNavigate/nested/"!
    </div>
  )
}
