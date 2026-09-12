import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <section>
      <h1 data-testid="home-heading">Deferred Hydration</h1>
      <h2>Component strategies</h2>
      <Link to="/components">component strategies</Link>
      <h2>CSS</h2>
      <Link to="/css">CSS deferred hydration</Link>
      <h2>Imported component</h2>
      <Link to="/imported" preload="intent">
        imported Hydrate
      </Link>
      <h2>Enhanced APIs</h2>
      <Link to="/enhanced">enhanced Hydrate APIs</Link>
    </section>
  )
}
