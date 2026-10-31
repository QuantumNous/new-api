import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-c/about')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-c:about</div>
}
