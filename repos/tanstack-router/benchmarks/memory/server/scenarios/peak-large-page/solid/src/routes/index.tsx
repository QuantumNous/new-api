import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <main data-bench="peak-large-page-index">peak-large-page-index</main>
}
