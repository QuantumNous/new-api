import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <div>hello world</div>
}
