import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-lg">
        Server Routes Global Middleware Deduplication E2E Tests
      </h1>
      <p className="text-gray-600 mb-4">
        Tests for issue #5239: global request middleware is executed multiple
        times for single request (server routes variant)
      </p>
      <ul className="list-disc p-4">
        <li>
          <Link
            to="/server-route-with-middleware"
            data-testid="link-server-route"
          >
            Server route with middleware - tests deduplication when same
            middleware is in global requestMiddleware and server route
          </Link>
        </li>
      </ul>
    </div>
  )
}
