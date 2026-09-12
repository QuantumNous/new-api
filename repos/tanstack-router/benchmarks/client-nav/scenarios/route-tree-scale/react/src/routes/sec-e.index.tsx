import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-e/')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-e:index</div>
}
