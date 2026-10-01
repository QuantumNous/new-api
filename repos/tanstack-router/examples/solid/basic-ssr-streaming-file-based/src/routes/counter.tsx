import { createFileRoute } from '@tanstack/solid-router'
import Counter from './-components/Counter'

export const Route = createFileRoute('/counter')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Counter />
}
