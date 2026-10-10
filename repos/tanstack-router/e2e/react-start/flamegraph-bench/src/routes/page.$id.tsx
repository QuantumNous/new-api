import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/page/$id')({
  component: PageComponent,
})

function PageComponent() {
  const { id } = Route.useParams()

  // 100 links = 100 buildLocation calls during SSR
  return (
    <div>
      <h1 data-testid="page-title">Page {id}</h1>
      <div>
        {Array.from({ length: 100 }, (_, i) => (
          <Link
            key={i}
            to="/page/$id"
            params={{ id: String(i % 10) }}
            data-testid={`link-${i}`}
            style={{ display: 'block', margin: '2px 0' }}
          >
            Go to Page {i % 10}
          </Link>
        ))}
      </div>
    </div>
  )
}
