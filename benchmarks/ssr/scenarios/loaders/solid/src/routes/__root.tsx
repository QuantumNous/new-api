import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootComponent,
  validateSearch: (s: Record<string, unknown>) => ({
    page: typeof s.page === 'number' ? s.page : 0,
    tags: Array.isArray(s.tags) ? (s.tags as Array<string>) : [],
  }),
})

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
