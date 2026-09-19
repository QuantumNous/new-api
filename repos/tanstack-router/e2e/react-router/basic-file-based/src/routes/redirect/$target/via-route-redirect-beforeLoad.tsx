import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/redirect/$target/via-route-redirect-beforeLoad',
)({
  beforeLoad: ({ params: { target }, search: { externalHost } }) => {
    switch (target) {
      case 'internal':
        // Use relative redirect to sibling route - this is the key feature being tested
        // Note: '../destination' is the correct relative path for sibling navigation
        throw Route.redirect({ to: '../destination' })
      case 'external':
        throw Route.redirect({ href: externalHost ?? 'http://example.com' })
    }
  },
  component: () => <div>{Route.fullPath}</div>,
})
