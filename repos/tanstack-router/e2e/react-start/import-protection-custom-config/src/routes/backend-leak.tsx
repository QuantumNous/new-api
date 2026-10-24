import { createFileRoute } from '@tanstack/react-router'
// This import triggers a file-based violation in the CLIENT env:
//   backend-leak.tsx -> lib/credentials.backend.ts
// The custom deny pattern `**/*.backend.*` should catch this.
import { getBackendSecret } from '../lib/credentials.backend'

export const Route = createFileRoute('/backend-leak')({
  component: BackendLeakRoute,
})

function BackendLeakRoute() {
  return (
    <div>
      <h1 data-testid="backend-leak-heading">Backend Leak</h1>
      <p data-testid="backend-leak-result">{String(getBackendSecret())}</p>
    </div>
  )
}
