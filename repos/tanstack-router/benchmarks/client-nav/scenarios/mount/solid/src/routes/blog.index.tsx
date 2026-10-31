import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/blog/')({
  component: BlogIndexPage,
})

function BlogIndexPage() {
  return <p>All articles</p>
}
