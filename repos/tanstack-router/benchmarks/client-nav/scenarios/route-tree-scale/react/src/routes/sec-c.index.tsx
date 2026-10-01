import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-c/')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-c:index</div>
}
