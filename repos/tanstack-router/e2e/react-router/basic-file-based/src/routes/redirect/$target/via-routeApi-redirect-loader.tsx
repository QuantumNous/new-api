import { createFileRoute, getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/redirect/$target/via-routeApi-redirect-loader')

export const Route = createFileRoute(
  '/redirect/$target/via-routeApi-redirect-loader',
)({
  loaderDeps: ({ search: { externalHost } }) => ({
    externalHost,
  }),
  loader: ({ params: { target }, deps: { externalHost } }) => {
    switch (target) {
      case 'internal':
        // Use relative redirect to sibling route - this is the key feature being tested
        // Note: '../destination' is the correct relative path for sibling navigation
        throw routeApi.redirect({ to: '../destination' })
      case 'external':
        throw routeApi.redirect({ href: externalHost ?? 'http://example.com' })
    }
  },
  component: () => <div>{Route.fullPath}</div>,
})
