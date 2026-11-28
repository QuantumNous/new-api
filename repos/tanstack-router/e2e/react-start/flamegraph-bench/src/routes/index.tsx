import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div>
      <h1 data-testid="page-title">Flamegraph Benchmark - Index</h1>
      <p>Navigate to any page to start:</p>
      <div>
        {Array.from({ length: 10 }, (_, i) => (
          <Link
            key={i}
            to="/page/$id"
            params={{ id: String(i) }}
            style={{ marginRight: '10px' }}
          >
            Page {i}
          </Link>
        ))}
      </div>
    </div>
  )
}
