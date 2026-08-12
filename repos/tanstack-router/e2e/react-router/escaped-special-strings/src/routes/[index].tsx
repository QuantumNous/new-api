import { createFileRoute } from '@tanstack/react-router'

// This file uses [index] escaping to create a literal /index route
// instead of being treated as an index route for the parent
export const Route = createFileRoute('/index')({
  component: EscapedIndexComponent,
})

function EscapedIndexComponent() {
  return (
    <div>
      <h2 data-testid="page-title">Escaped Index Page</h2>
      <p data-testid="page-path">/index</p>
      <p data-testid="page-description">
        This route was created using [index].tsx to escape the special "index"
        token. It renders at the literal path /index instead of being the index
        route.
      </p>
    </div>
  )
}
