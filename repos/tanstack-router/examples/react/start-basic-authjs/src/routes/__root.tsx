/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import type { AuthSession } from 'start-authjs'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getSession } from 'start-authjs'
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
        charSet: 'utf-8',
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

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <NavBar />
        <main className="p-4">{children}</main>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}

function NavBar() {
  const routeContext = Route.useRouteContext()

  return (
    <nav className="p-4 flex gap-4 items-center bg-gray-100">
      <Link
        to="/"
        activeProps={{ className: 'font-bold' }}
        activeOptions={{ exact: true }}
      >
        Home
      </Link>
      <Link to="/protected" activeProps={{ className: 'font-bold' }}>
        Protected
      </Link>
      <div className="ml-auto flex items-center gap-4">
        {routeContext.session ? (
          <>
            <span className="text-gray-600">
              {routeContext.session?.user?.name ||
                routeContext.session?.user?.email}
            </span>
            <a
              href="/api/auth/signout"
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Sign Out
            </a>
          </>
        ) : (
          <Link
            to="/login"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}
