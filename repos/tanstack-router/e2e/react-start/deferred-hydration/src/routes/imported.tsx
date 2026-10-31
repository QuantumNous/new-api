import { createFileRoute } from '@tanstack/react-router'
import { ImportedHydrateWidget } from '../shared/ImportedHydrateWidget'

export const Route = createFileRoute('/imported')({
  component: ImportedHydrationPage,
})

function ImportedHydrationPage() {
  return (
    <section>
      <h1 data-testid="imported-heading">Imported Hydrate</h1>
      <ImportedHydrateWidget />
    </section>
  )
}
