import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/specialChars/대한민국')({
  component: KoreaComponent,
})

function KoreaComponent() {
  return (
    <div class="p-2">
      Test
      <h3 data-testid="special-non-latin-heading">
        Hello /specialChars/대한민국
      </h3>
      <p>This is a route with a non-ASCII path.</p>
    </div>
  )
}
