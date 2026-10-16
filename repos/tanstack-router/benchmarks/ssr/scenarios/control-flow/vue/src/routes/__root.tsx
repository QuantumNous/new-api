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
  notFoundComponent: RootNotFoundComponent,
  validateSearch: (s) => s as { q?: string },
})

function RootNotFoundComponent() {
  return <main>root-not-found-marker</main>
}

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
