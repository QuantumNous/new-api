import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-b/')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-b:index</div>
}
