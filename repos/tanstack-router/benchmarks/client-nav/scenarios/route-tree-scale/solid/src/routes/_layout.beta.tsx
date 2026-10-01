import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/_layout/beta')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">beta</div>
}
