import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <main data-bench="streaming-peak-index">streaming-peak-index</main>
}
