import { Outlet, createFileRoute } from '@tanstack/react-router'
import type { BeforeLoadContext } from '../../../shared'

export const Route = createFileRoute('/$a/$b')({
  beforeLoad: ({ params, context }) => {
    const parent = context as BeforeLoadContext

    return {
      chainToken: `${parent.chainToken}.${params.b}`,
      ctxB: params.b,
    }
  },
  component: LevelBComponent,
})

function LevelBComponent() {
  return <Outlet />
}
