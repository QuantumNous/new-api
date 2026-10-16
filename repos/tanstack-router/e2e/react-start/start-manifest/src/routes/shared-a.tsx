import { createFileRoute } from '@tanstack/react-router'
import { SharedNestedLayout } from '~/components/SharedNestedLayout'

export const Route = createFileRoute('/shared-a')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SharedNestedLayout>
      <div data-testid="shared-a-card">Shared route A</div>
    </SharedNestedLayout>
  )
}
