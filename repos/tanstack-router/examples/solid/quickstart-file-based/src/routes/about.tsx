import { createFileRoute } from '@tanstack/solid-router'
export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div class="p-2">
      <h3>About</h3>
    </div>
  )
}
