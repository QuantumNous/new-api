import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/_layout/alpha')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">alpha</div>
}
