import { createFileRoute } from '@tanstack/vue-router'
export const Route = createFileRoute('/_pathlessLayout/_nested-layout/route-a')(
  {
    component: LayoutAComponent,
  },
)

function LayoutAComponent() {
  return <div>I'm layout A!</div>
}
