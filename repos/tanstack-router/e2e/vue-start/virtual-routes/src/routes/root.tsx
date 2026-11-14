/// <reference types="vite/client" />
import {
  Body,
  HeadContent,
  Html,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/vue-router'
import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    )
  },
  head: () => {
    return {
      links: [{ rel: 'stylesheet', href: appCss }],
    }
  },
})

function RootComponent() {
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
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
            to="/posts"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Posts
          </Link>{' '}
          <Link
            to="/route-without-file/layout-a"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Layout
          </Link>{' '}
          <Link
            to="/classic/hello"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Subtree
          </Link>{' '}
          <Link
            data-testid="special-pipe-link"
            to="/special|pipe"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Pipe
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
        {/* Start rendering router matches */}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </Body>
    </Html>
  )
}
