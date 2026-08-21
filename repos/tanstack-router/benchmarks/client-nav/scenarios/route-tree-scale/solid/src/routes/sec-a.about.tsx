import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-a/about')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-a:about</div>
}
