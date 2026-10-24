import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { photoLabel } from '../../../shared'

const PhotoComponent = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <main>
        <h1 data-testid="photo-state">{photoLabel(params.value.photoId)}</h1>
      </main>
    )
  },
})

export const Route = createFileRoute('/photos/$photoId')({
  component: PhotoComponent,
})
