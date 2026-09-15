import { createFileRoute } from '@tanstack/solid-router'
import { pageLabel } from '../../../shared'

export const Route = createFileRoute('/pages/$n')({
  component: PageComponent,
})

function PageComponent() {
  const params = Route.useParams()

  return (
    <main>
      <h1 data-testid="page-state">{pageLabel(params().n)}</h1>
    </main>
  )
}
