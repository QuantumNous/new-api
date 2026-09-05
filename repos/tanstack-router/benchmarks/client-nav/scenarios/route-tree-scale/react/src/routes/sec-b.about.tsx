import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-b/about')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">sec-b:about</div>
}
