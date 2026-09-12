import { Link, createFileRoute } from '@tanstack/react-router'

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
        rewrite-leaf {data.a} {data.b}
      </p>
      <Link
        to="/p/$a/$b"
        params={{ a: data.a, b: data.b }}
        search={{ _locale: 'fr' }}
      >
        leaf-self-link
      </Link>
      <Link
        to="/p/$a/$b"
        params={{ a: data.a, b: data.nextB }}
        search={{ _locale: 'fr' }}
      >
        leaf-next-link
      </Link>
      <Link to="/p/$a" params={{ a: data.a }} search={{ _locale: 'fr' }}>
        leaf-parent-link
      </Link>
    </section>
  )
}
