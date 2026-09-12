import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/links')({
  component: LinksComponent,
})

function LinksComponent() {
  return (
    <div class="p-2">
      <h3>Links</h3>
    </div>
  )
}
