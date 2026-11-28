import { createFileRoute } from '@tanstack/solid-router'
export const Route = createFileRoute('/_pathlessLayout/route-b')({
  component: LayoutBComponent,
})

function LayoutBComponent() {
  return <div>I'm B!</div>
}
