import { createFileRoute } from '@tanstack/react-router'
import { docsMarker } from '../../../shared'

export const Route = createFileRoute('/docs')({
  component: DocsPage,
})

function DocsPage() {
  return (
    <main>
      <p data-testid="page-state">{docsMarker}</p>
    </main>
  )
}
