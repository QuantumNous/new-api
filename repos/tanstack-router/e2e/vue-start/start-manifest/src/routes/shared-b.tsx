import { createFileRoute } from '@tanstack/vue-router'
import { SharedNestedLayout } from '~/components/SharedNestedLayout'

export const Route = createFileRoute('/shared-b')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SharedNestedLayout>
      <div data-testid="shared-b-card">Shared route B</div>
    </SharedNestedLayout>
  )
}
