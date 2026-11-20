import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/01-example/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/01-example/"!</div>
}
