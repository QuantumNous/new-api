import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div>
      <h1 data-testid="home-heading">Welcome Home</h1>
      <p data-testid="home-content">
        This page tests the transformAssets feature.
      </p>
      <Link to="/about" data-testid="link-to-about">
        About
      </Link>
    </div>
  )
}
