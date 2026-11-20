import { Link, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    )
  },
})
