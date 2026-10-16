import { createFileRoute } from '@tanstack/solid-router'
import { throwRedirect } from '~/components/throwRedirect'

export const Route = createFileRoute('/redirect/$target/serverFn/via-loader')({
  loaderDeps: ({ search: { reloadDocument, externalHost } }) => ({
    reloadDocument,
    externalHost,
  }),
  loader: ({ params: { target }, deps: { reloadDocument, externalHost } }) =>
    throwRedirect({ data: { target, reloadDocument, externalHost } }),
  component: () => <div>{Route.fullPath}</div>,
})
