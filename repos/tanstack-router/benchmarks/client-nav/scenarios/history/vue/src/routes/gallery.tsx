import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const GalleryPage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <h1 data-testid="gallery-state">Gallery</h1>
      </main>
    )
  },
})

export const Route = createFileRoute('/gallery')({
  component: GalleryPage,
})
