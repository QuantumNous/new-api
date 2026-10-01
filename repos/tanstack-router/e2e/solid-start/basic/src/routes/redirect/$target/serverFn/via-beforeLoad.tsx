import { createFileRoute } from '@tanstack/solid-router'
import { throwRedirect } from '~/components/throwRedirect'

export const Route = createFileRoute(
  '/redirect/$target/serverFn/via-beforeLoad',
)({
  beforeLoad: ({
    params: { target },
    search: { reloadDocument, externalHost },
  }) => throwRedirect({ data: { target, reloadDocument, externalHost } }),
  component: () => <div>{Route.fullPath}</div>,
})
