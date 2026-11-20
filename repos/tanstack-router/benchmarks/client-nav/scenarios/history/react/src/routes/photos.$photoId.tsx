import { createFileRoute } from '@tanstack/react-router'
import { photoLabel } from '../../../shared'

export const Route = createFileRoute('/photos/$photoId')({
  component: PhotoComponent,
})

function PhotoComponent() {
  const params = Route.useParams()

  return (
    <main>
      <h1 data-testid="photo-state">{photoLabel(params.photoId)}</h1>
    </main>
  )
}
