import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main>
      <div data-testid="home-state">home</div>
    </main>
  )
}
