import { createFileRoute } from '@tanstack/vue-router'
export const Route = createFileRoute('/_first/_second/layout-a')({
  component: LayoutAComponent,
})

function LayoutAComponent() {
  return <div>I'm layout A!</div>
}
