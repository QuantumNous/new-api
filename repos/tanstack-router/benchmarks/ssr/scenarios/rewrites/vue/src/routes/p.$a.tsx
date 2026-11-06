import { Link, Outlet, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/p/$a')({
  loader: ({ params }) => ({
    a: params.a,
    nextB: `branch-${params.a}`,
  }),
  component: ParentComponent,
})

function ParentComponent() {
  const data = Route.useLoaderData()

  return (
    <section>
      <p>rewrite-parent {data.value.a}</p>
      <Link
        to="/p/$a/$b"
        params={{ a: data.value.a, b: data.value.nextB }}
        search={{ _locale: 'fr' }}
      >
        parent-branch-link
      </Link>
      <Outlet />
    </section>
  )
}
