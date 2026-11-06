import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect/$target/via-loader')({
  loaderDeps: ({ search: { reloadDocument, externalHost } }) => ({
    reloadDocument,
    externalHost,
  }),
  loader: ({ params: { target }, deps: { externalHost, reloadDocument } }) => {
    switch (target) {
      case 'internal':
        throw redirect({ to: '/posts', reloadDocument })
      case 'external':
        throw redirect({ href: externalHost })
    }
  },
  component: () => <div>{Route.fullPath}</div>,
})
