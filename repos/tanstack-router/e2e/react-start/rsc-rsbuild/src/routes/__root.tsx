import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useHydrated,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Rsbuild RSC test' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const hydrated = useHydrated()

  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <span data-testid="app-hydrated" style={{ display: 'none' }}>
          {hydrated ? 'hydrated' : 'hydrating'}
        </span>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
