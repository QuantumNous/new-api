import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div data-testid="home-container">
      <h1 data-testid="home-heading">Home</h1>
      <div>
        <Link
          to="/posts/$postId"
          params={{ postId: '1' }}
          data-testid="link-posts-1"
        >
          Go to /posts/1
        </Link>
      </div>
    </div>
  )
}
