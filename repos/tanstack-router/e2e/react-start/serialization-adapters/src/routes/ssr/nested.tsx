import { createFileRoute } from '@tanstack/react-router'
import { RenderNestedData, makeNested } from '~/data'

export const Route = createFileRoute('/ssr/nested')({
  beforeLoad: () => {
    return { nested: makeNested() }
  },
  loader: ({ context }) => {
    return context
  },
  component: () => {
    return <RenderNestedData nested={Route.useLoaderData().nested} />
  },
})
