import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-b/settings')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-b:settings</div>
}
