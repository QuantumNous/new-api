import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div data-testid="home">
      <h1>Inline CSS home</h1>
      <Link to="/app/dashboard">Open dashboard</Link>
    </div>
  )
}
