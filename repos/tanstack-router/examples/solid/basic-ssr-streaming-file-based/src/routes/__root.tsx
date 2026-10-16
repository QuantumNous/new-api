import { Link, Outlet, createRootRoute } from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import stylesCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    links: [
      { rel: 'icon', href: '/images/favicon.ico' },
      { rel: 'stylesheet', href: stylesCss },
    ],
    meta: [
      {
        title: 'TanStack Router SSR Basic File Based Streaming',
      },
      {
        charSet: 'UTF-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0',
      },
    ],
    scripts: [
      {
        type: 'module',
        src: import.meta.env.PROD
          ? '/static/entry-client.js'
          : '/src/entry-client.tsx',
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    )
  },
})

function RootComponent() {
  return (
    <>
      <div class="p-2 flex gap-2 text-lg border-b">
        <Link
          to="/"
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>{' '}
        <Link
          to="/counter"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Counter
        </Link>{' '}
        <Link
          to="/posts"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Posts
        </Link>{' '}
        <Link
          to="/route-a"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Pathless Layout
        </Link>{' '}
        <Link
          // @ts-expect-error
          to="/this-route-does-not-exist"
          activeProps={{
            class: 'font-bold',
          }}
        >
          This Route Does Not Exist
        </Link>
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
