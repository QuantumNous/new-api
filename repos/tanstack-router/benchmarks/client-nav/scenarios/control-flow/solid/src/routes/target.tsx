import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/target')({
  component: TargetPage,
})

function TargetPage() {
  return <div data-testid="target-state">target</div>
}
