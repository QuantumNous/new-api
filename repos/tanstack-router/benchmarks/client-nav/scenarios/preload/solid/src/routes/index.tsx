import { createFileRoute } from '@tanstack/solid-router'
import { homeMarker } from '../../../shared'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main>
      <p data-testid="page-state">{homeMarker}</p>
    </main>
  )
}
