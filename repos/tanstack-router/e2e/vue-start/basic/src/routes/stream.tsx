import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/stream')({
  component: StreamComponent,
})

function StreamComponent() {
  return (
    <div class="p-2">
      <h3>Stream Test</h3>
    </div>
  )
}
