import {
  Body,
  HeadContent,
  Html,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/vue-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'application-name', content: 'SSR head benchmark' },
      { name: 'description', content: 'Head-heavy SSR benchmark scenario' },
      { name: 'theme-color', content: '#111827' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: RootComponent,
  validateSearch: (s) => s as { q?: string },
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
