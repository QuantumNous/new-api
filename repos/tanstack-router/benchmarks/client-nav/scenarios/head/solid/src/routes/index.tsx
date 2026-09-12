import { createFileRoute } from '@tanstack/solid-router'
import { homeHead, homeTitle } from '../../../shared'

export const Route = createFileRoute('/')({
  head: homeHead,
  component: HomePage,
})

function HomePage() {
  return (
    <main>
      <h1>{homeTitle}</h1>
      <p>Landing page</p>
    </main>
  )
}
