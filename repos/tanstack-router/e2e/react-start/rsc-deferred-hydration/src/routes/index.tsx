import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <section className="hero">
      <h1 data-testid="home-heading">RSC meets Deferred Hydration</h1>
      <p>
        These routes render React Server Components that cross into client
        components using <code>Hydrate</code>. Each card explains when its
        client island should hydrate and keeps server-rendered HTML visible
        first.
      </p>
      <div className="grid">
        <Link to="/server-client" className="card">
          <strong>Server component to client Hydrate</strong>
          The RSC renders a separate <code>"use client"</code> component that
          defers hydration until interaction.
        </Link>
        <Link to="/composite" className="card">
          <strong>Composite server shell</strong>A server component owns the
          visual frame while a client child hydrates only after it becomes
          visible.
        </Link>
        <Link to="/css" className="card">
          <strong>CSS module client island</strong>A server component renders a
          client Hydrate boundary whose child uses CSS modules.
        </Link>
      </div>
    </section>
  )
}
