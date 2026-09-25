import { createFileRoute } from '@tanstack/solid-router'
import {
  getGlobalMiddlewareContext,
  makeDocumentMarker,
  type GlobalMiddlewareContext,
} from '../../../shared'

export const Route = createFileRoute('/page/$id')({
  beforeLoad: ({ serverContext }) => ({
    globalMiddlewareContext: (serverContext ?? {}) as GlobalMiddlewareContext,
  }),
  loader: ({ params, context }) => ({
    marker: makeDocumentMarker(params.id, getGlobalMiddlewareContext(context)),
  }),
  component: PageComponent,
})

function PageComponent() {
  const data = Route.useLoaderData()

  return <main>{data().marker}</main>
}
