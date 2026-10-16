import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/scroll-error')({
  component: ScrollErrorComponent,
})

function ScrollErrorComponent() {
  return (
    <div>
      <Link to="/about">About</Link>
      <div style={{ height: '2000px' }}>
        <h1>Scroll Error Test</h1>
      </div>
    </div>
  )
}
