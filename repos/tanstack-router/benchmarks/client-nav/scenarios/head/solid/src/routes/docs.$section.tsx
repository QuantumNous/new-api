import { createFileRoute } from '@tanstack/solid-router'
import { docsDescription, docsSectionHead, docsTitle } from '../../../shared'

export const Route = createFileRoute('/docs/$section')({
  head: ({ params }) => docsSectionHead(params.section),
  component: DocsSectionPage,
})

function DocsSectionPage() {
  const params = Route.useParams()

  return (
    <article>
      <h1>{docsTitle(params().section)}</h1>
      <p>{docsDescription(params().section)}</p>
    </article>
  )
}
