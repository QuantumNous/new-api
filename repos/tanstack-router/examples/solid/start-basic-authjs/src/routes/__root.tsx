/// <reference types="vite/client" />
import type { AuthSession } from 'start-authjs'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { createServerFn } from '@tanstack/solid-start'
import { getRequest } from '@tanstack/solid-start/server'
import { HydrationScript } from 'solid-js/web'
import { Show } from 'solid-js'
import { getSession } from 'start-authjs'
import type { JSX } from 'solid-js'
import { authConfig } from '~/utils/auth'
import appCss from '~/styles/app.css?url'

interface RouterContext {
  session: AuthSession | null
}

const fetchSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const session = await getSession(request, authConfig)
  return session
})

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const session = await fetchSession()
    return {
      session,
    }
  },
  head: () => ({
    meta: [
      {
        charset: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Auth Example',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: JSX.Element }) {
  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <NavBar />
        <main class="p-4">{children}</main>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}

function NavBar() {
  const routeContext = Route.useRouteContext()

  return (
    <nav class="p-4 flex gap-4 items-center bg-gray-100">
      <Link
        to="/"
        activeProps={{ class: 'font-bold' }}
        activeOptions={{ exact: true }}
      >
        Home
      </Link>
      <Link to="/protected" activeProps={{ class: 'font-bold' }}>
        Protected
      </Link>
      <div class="ml-auto flex items-center gap-4">
        <Show
          when={routeContext().session}
          fallback={
            <Link
              to="/login"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Sign In
            </Link>
          }
        >
          <span class="text-gray-600">
            {routeContext().session?.user?.name ||
              routeContext().session?.user?.email}
          </span>
          <a
            href="/api/auth/signout"
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign Out
          </a>
        </Show>
      </div>
    </nav>
  )
}
