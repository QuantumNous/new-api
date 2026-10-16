import { For } from 'solid-js'
import { Link, Outlet, createRootRoute } from '@tanstack/solid-router'
import { sections } from '../../../shared'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <nav>
        <Link to="/" data-testid="go-home">
          Home
        </Link>
        <For each={sections}>
          {(section) => (
            <Link
              to="/sections/$section"
              params={{ section }}
              data-testid={`s-${section}`}
            >
              {`Section ${section}`}
            </Link>
          )}
        </For>
        <Link to="/docs" data-testid="go-docs">
          Docs
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
