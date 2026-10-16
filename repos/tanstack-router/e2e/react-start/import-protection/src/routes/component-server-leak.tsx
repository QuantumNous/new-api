import { createFileRoute } from '@tanstack/react-router'
// This import is used ONLY inside the route component.
// The router plugin code-splits the component into a lazy chunk,
// moving this import into the split module.
// Import protection must still catch this as a violation.
import { getComponentSecret } from '../violations/db-credentials.server'

export const Route = createFileRoute('/component-server-leak')({
  component: ComponentServerLeak,
})

function ComponentServerLeak() {
  return (
    <div>
      <h1 data-testid="component-leak-heading">Component Server Leak</h1>
      <p data-testid="component-leak-secret">{getComponentSecret()}</p>
    </div>
  )
}
