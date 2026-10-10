import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-d/settings')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-d:settings</div>
}
