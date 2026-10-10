import { createFileRoute } from '@tanstack/vue-router'
import { churnGet, churnPost } from '../fns'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <main
      data-bench="server-fn-churn-index"
      data-get={churnGet.url}
      data-post={churnPost.url}
    >
      memory-server-fn-churn-index
    </main>
  )
}
