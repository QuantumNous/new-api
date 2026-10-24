import { createFileRoute } from '@tanstack/react-router'
import { echoPost } from '../fns'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <main data-post={echoPost.url}>global-middleware</main>
}
