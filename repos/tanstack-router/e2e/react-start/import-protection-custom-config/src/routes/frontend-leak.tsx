import { createFileRoute } from '@tanstack/react-router'
// This import triggers a file-based violation in the SERVER (SSR) env:
//   frontend-leak.tsx -> lib/browser-api.frontend.ts
// The custom deny pattern `**/*.frontend.*` should catch this.
import { getBrowserInfo } from '../lib/browser-api.frontend'

export const Route = createFileRoute('/frontend-leak')({
  component: FrontendLeakRoute,
})

function FrontendLeakRoute() {
  return (
    <div>
      <h1 data-testid="frontend-leak-heading">Frontend Leak</h1>
      <p data-testid="frontend-leak-result">{String(getBrowserInfo())}</p>
    </div>
  )
}
