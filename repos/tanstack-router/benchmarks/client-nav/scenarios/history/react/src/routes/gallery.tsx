import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/gallery')({
  component: GalleryPage,
})

function GalleryPage() {
  return (
    <main>
      <h1 data-testid="gallery-state">Gallery</h1>
    </main>
  )
}
