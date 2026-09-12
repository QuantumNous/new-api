import { createFileRoute } from '@tanstack/react-router'
import { makeBeforeLoadMarker, type BeforeLoadContext } from '../../../shared'

export const Route = createFileRoute('/$a/$b/$c')({
  beforeLoad: ({ params, context }) => {
    const parent = context as BeforeLoadContext

    return {
      chainToken: `${parent.chainToken}.${params.c}`,
      ctxC: params.c,
    }
  },
  loader: ({ context }) => ({
    marker: makeBeforeLoadMarker(context as BeforeLoadContext),
  }),
  component: LevelCComponent,
})

function LevelCComponent() {
  const data = Route.useLoaderData()

  return <main>{data.marker}</main>
}
