import { createFileRoute } from '@tanstack/solid-router'
export const Route = createFileRoute('/_first/_second/layout-b')({
  component: LayoutBComponent,
})

function LayoutBComponent() {
  return <div>I'm layout B!</div>
}
