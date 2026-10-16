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
