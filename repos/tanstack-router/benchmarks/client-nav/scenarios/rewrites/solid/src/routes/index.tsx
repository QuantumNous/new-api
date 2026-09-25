import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main>
      <h1>Home</h1>
    </main>
  )
}
