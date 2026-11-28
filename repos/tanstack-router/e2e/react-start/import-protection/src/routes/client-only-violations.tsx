import { createFileRoute } from '@tanstack/react-router'
// This import triggers a file-based violation in the SSR env:
//   client-only-violations.tsx -> violations/browser-api.client.ts (denied by **/*.client.*)
import { getBrowserTitle } from '../violations/browser-api.client'
// This import chain triggers a marker violation in the SSR env:
//   client-only-violations.tsx -> violations/marked-client-only-edge.ts -> violations/marked-client-only.ts
import { getClientOnlyDataViaEdge } from '../violations/marked-client-only-edge'

export const Route = createFileRoute('/client-only-violations')({
  component: ClientOnlyViolations,
})

function ClientOnlyViolations() {
  return (
    <div>
      <h1 data-testid="client-only-heading">Client-Only Violations</h1>
      <p data-testid="browser-title">{getBrowserTitle()}</p>
      <p data-testid="client-only-data">{getClientOnlyDataViaEdge()}</p>
    </div>
  )
}
