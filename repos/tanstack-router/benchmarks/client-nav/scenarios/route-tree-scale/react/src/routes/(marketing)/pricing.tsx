import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(marketing)/pricing')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">pricing</div>
}
