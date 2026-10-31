import { Outlet, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/$a')({
  beforeLoad: ({ params }) => ({
    chainToken: params.a,
    ctxA: params.a,
  }),
  component: LevelAComponent,
})

function LevelAComponent() {
  return <Outlet />
}
