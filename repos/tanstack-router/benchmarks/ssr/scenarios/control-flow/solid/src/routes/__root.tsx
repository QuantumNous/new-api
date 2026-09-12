import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: RootNotFoundComponent,
  validateSearch: (s) => s as { q?: string },
})

function RootNotFoundComponent() {
  return <main>root-not-found-marker</main>
}

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
