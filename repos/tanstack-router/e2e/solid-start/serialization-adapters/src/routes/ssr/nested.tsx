import { createFileRoute } from '@tanstack/solid-router'
import { RenderNestedData, makeNested } from '~/data'

export const Route = createFileRoute('/ssr/nested')({
  beforeLoad: () => {
    return { nested: makeNested() }
  },
  loader: ({ context }) => {
    return context
  },
  component: () => {
    const loaderData = Route.useLoaderData()
    return <RenderNestedData nested={loaderData().nested} />
  },
})
