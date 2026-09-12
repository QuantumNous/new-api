import { createFileRoute } from '@tanstack/react-router'
import { aboutMarker } from '../../../shared'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <main>
      <p data-testid="page-state">{aboutMarker}</p>
    </main>
  )
}
