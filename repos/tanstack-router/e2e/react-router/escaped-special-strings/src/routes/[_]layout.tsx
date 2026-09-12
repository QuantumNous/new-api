import { createFileRoute } from '@tanstack/react-router'

// This file uses [_]layout escaping to create a literal /_layout path
// instead of being treated as a pathless layout route
export const Route = createFileRoute('/_layout')({
  component: EscapedUnderscoreLayoutComponent,
})

function EscapedUnderscoreLayoutComponent() {
  return (
    <div>
      <h2 data-testid="page-title">Escaped Underscore Layout Page</h2>
      <p data-testid="page-path">/_layout</p>
      <p data-testid="page-description">
        This route was created using [_]layout.tsx to escape the leading
        underscore. It renders at the literal path /_layout instead of being a
        pathless layout.
      </p>
    </div>
  )
}
