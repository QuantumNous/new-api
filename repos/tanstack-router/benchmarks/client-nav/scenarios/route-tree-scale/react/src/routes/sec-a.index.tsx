import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-a/')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-a:index</div>
}
