import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-a/settings')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-a:settings</div>
}
