import { createFileRoute } from '@tanstack/solid-router'
import { articleData } from '../../../shared'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => articleData(params.slug),
  component: ArticlePage,
})

function ArticlePage() {
  const article = Route.useLoaderData()

  return <article>{`${article().title} (${article().words} words)`}</article>
}
