import { createFileRoute } from '@tanstack/react-router'

// This file uses [lazy] escaping to create a literal /lazy path
// instead of being treated as a lazy-loaded route
export const Route = createFileRoute('/lazy')({
  component: EscapedLazyComponent,
})

function EscapedLazyComponent() {
  return (
    <div>
      <h2 data-testid="page-title">Escaped Lazy Page</h2>
      <p data-testid="page-path">/lazy</p>
      <p data-testid="page-description">
        This route was created using [lazy].tsx to escape the special "lazy"
        token. It renders at the literal path /lazy instead of being a
        lazy-loaded route.
      </p>
    </div>
  )
}
