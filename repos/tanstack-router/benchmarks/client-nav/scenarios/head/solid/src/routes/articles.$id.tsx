import { createFileRoute } from '@tanstack/solid-router'
import { articleDescription, articleHead, articleTitle } from '../../../shared'

export const Route = createFileRoute('/articles/$id')({
  head: ({ params }) => articleHead(params.id),
  component: ArticlePage,
})

function ArticlePage() {
  const params = Route.useParams()

  return (
    <article>
      <h1>{articleTitle(params().id)}</h1>
      <p>{articleDescription(params().id)}</p>
    </article>
  )
}
