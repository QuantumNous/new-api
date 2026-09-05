import { createFileRoute } from '@tanstack/solid-router'
import Counter from '~/components/Counter'
export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main>
      <h1>Hello world!</h1>
      <Counter />
    </main>
  )
}
