import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-lg">
        Global Middleware Deduplication E2E Tests
      </h1>
      <p className="text-gray-600 mb-4">
        Tests for issue #5239: global request middleware is executed multiple
        times for single request
      </p>
      <ul className="list-disc p-4">
        <li>
          <Link to="/simple" data-testid="link-simple">
            Simple test - single server function with global middleware
          </Link>
        </li>
        <li>
          <Link to="/multiple-server-functions" data-testid="link-multiple">
            Complex test - multiple server functions in loader with shared
            global middleware
          </Link>
        </li>
        <li>
          <Link to="/pathname-middleware" data-testid="link-pathname">
            Pathname test - verify pathname is passed to global request
            middleware
          </Link>
        </li>
      </ul>
    </div>
  )
}
