import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <main data-bench="aborted-requests-index">aborted-requests-index</main>
}
