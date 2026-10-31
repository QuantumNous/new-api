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
    _locale: typeof s._locale === 'string' ? s._locale : undefined,
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
