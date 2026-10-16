import { createFileRoute } from '@tanstack/solid-router'
import { Link, Outlet } from '@tanstack/solid-router'

export const Route = createFileRoute('/classic/hello')({
  component: () => (
    <div>
      Hello!
      <br />{' '}
      <Link
        to="/classic/hello/universe"
        activeProps={{
          class: 'font-bold',
        }}
      >
        say hello to the universe
      </Link>{' '}
      <Link
        to="/classic/hello/world"
        activeProps={{
          class: 'font-bold',
        }}
      >
        say hello to the world
      </Link>
      <Outlet />
    </div>
  ),
})
