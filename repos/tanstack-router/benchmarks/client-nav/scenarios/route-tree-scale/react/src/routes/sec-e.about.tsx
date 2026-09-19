import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-e/about')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-e:about</div>
}
