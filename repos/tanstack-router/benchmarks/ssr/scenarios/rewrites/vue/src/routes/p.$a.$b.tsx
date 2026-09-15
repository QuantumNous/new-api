import { Link, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/p/$a/$b')({
  loader: ({ params }) => ({
    a: params.a,
    b: params.b,
    nextB: `next-${params.b}`,
  }),
  component: LeafComponent,
})

function LeafComponent() {
  const data = Route.useLoaderData()

  return (
    <section>
      <p>
        rewrite-leaf {data.value.a} {data.value.b}
      </p>
      <Link
        to="/p/$a/$b"
        params={{ a: data.value.a, b: data.value.b }}
        search={{ _locale: 'fr' }}
      >
        leaf-self-link
      </Link>
      <Link
        to="/p/$a/$b"
        params={{ a: data.value.a, b: data.value.nextB }}
        search={{ _locale: 'fr' }}
      >
        leaf-next-link
      </Link>
      <Link to="/p/$a" params={{ a: data.value.a }} search={{ _locale: 'fr' }}>
        leaf-parent-link
      </Link>
    </section>
  )
}
