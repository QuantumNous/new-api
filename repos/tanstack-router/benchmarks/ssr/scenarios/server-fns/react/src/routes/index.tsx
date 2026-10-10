import { createFileRoute } from '@tanstack/react-router'
import { echoGet, echoPost } from '../fns'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <main data-get={echoGet.url} data-post={echoPost.url}>
      server-fns
    </main>
  )
}
