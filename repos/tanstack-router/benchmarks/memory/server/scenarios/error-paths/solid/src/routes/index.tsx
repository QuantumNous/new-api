import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <main data-bench="error-paths-index">error-paths-index</main>
}
