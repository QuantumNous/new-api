import { createFileRoute } from '@tanstack/react-router'
import { HelpCenterPage } from '@/features/help-center'

export const Route = createFileRoute('/help/$slug')({
  component: HelpArticleRoute,
})

function HelpArticleRoute() {
  const { slug } = Route.useParams()
  return <HelpCenterPage slug={slug} />
}
