import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-d/about')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-d:about</div>
}
