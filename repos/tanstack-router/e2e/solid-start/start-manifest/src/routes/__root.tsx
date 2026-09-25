import { HeadContent, Scripts, createRootRoute } from '@tanstack/solid-router'
import { HydrationScript } from 'solid-js/web'
import { AppShell } from '~/components/AppShell'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TanStack Start Manifest Bloat E2E' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        <AppShell />
        <Scripts />
      </body>
    </html>
  )
}
