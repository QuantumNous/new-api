import { For } from 'solid-js'
import { Link, Outlet, createRootRoute } from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootComponent,
})

const ids = ['1', '2']

function RootComponent() {
  return (
    <>
      <nav>
        <Link to="/" data-testid="go-home">
          Home
        </Link>
        <For each={ids}>
          {(id) => (
            <Link to="/slow/$id" params={{ id }} data-testid={`go-slow-${id}`}>
              {`Slow ${id}`}
            </Link>
          )}
        </For>
        <For each={ids}>
          {(id) => (
            <Link to="/ctx/$id" params={{ id }} data-testid={`go-ctx-${id}`}>
              {`Ctx ${id}`}
            </Link>
          )}
        </For>
        <For each={ids}>
          {(id) => (
            <Link
              to="/nested/$id"
              params={{ id }}
              data-testid={`go-nested-${id}`}
            >
              {`Nested ${id}`}
            </Link>
          )}
        </For>
      </nav>
      <Outlet />
    </>
  )
}
