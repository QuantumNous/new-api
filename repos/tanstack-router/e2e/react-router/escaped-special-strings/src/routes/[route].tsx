import { createFileRoute } from '@tanstack/react-router'

// This file uses [route] escaping to create a literal /route path
// instead of being treated as a layout configuration file
export const Route = createFileRoute('/route')({
  component: EscapedRouteComponent,
})

function EscapedRouteComponent() {
  return (
    <div>
      <h2 data-testid="page-title">Escaped Route Page</h2>
      <p data-testid="page-path">/route</p>
      <p data-testid="page-description">
        This route was created using [route].tsx to escape the special "route"
        token. It renders at the literal path /route instead of being a layout
        configuration.
      </p>
    </div>
  )
}
