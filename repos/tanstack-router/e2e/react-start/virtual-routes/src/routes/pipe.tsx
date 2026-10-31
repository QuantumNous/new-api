import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/special|pipe')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="special-pipe-route-heading">Hello "/special|pipe"!</div>
  )
}
