import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-f/settings')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-f:settings</div>
}
