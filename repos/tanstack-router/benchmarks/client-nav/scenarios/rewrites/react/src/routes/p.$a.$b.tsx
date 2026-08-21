import { createFileRoute } from '@tanstack/react-router'
import { itemLabel } from '../../../shared'

export const Route = createFileRoute('/p/$a/$b')({
  component: ItemPage,
})

function ItemPage() {
  const params = Route.useParams()

  return (
    <article>
      <h2>{itemLabel(params.a, params.b)}</h2>
    </article>
  )
}
