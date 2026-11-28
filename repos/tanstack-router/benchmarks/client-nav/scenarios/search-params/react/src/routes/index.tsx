import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main>
      <h1>Search Params Bench</h1>
      <div data-testid="home-state">home</div>
    </main>
  )
}
