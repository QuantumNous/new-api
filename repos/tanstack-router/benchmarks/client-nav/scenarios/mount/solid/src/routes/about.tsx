import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <p>About</p>
}
