import { createFileRoute } from '@tanstack/solid-router'
import { itemMarker } from '../../../shared'

export const Route = createFileRoute('/items/$id')({
  component: ItemPage,
})

function ItemPage() {
  const params = Route.useParams()

  return (
    <main>
      <p data-testid="page-state">{itemMarker(params().id)}</p>
    </main>
  )
}
