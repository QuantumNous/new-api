import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_layout-2/layout-b')({
  component: LayoutBComponent,
})

function LayoutBComponent() {
  return <div>I'm layout B!</div>
}
