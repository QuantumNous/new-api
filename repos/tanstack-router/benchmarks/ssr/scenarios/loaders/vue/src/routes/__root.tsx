import {
  Body,
  HeadContent,
  Html,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/vue-router'

export const Route = createRootRoute({
  component: RootComponent,
  validateSearch: (s: Record<string, unknown>) => ({
    page: typeof s.page === 'number' ? s.page : 0,
    tags: Array.isArray(s.tags) ? (s.tags as Array<string>) : [],
  }),
})

function RootComponent() {
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
        <Outlet />
        <Scripts />
      </Body>
    </Html>
  )
}
