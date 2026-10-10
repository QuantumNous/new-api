import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <main data-bench-page="index">index</main>
}
