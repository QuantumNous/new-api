import { createFileRoute } from '@tanstack/vue-router'
import { SharedNestedLayout } from '~/components/SharedNestedLayout'

export const Route = createFileRoute('/shared-c')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SharedNestedLayout>
      <div data-testid="shared-c-card">Shared route C</div>
    </SharedNestedLayout>
  )
}
