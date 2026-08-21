import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">home</div>
}
