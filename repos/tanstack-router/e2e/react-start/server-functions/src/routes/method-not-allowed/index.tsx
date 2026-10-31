import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/method-not-allowed/')({
  component: MethodNotAllowedIndex,
})

function MethodNotAllowedIndex() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-lg">
        Server functions E2E Method Not Allowed Tests
      </h1>
      <ul className="list-disc p-4">
        <li>
          <Link to="/method-not-allowed/$method" params={{ method: 'get' }}>
            Server function defined with GET method
          </Link>
        </li>
        <li>
          <Link
            to="/method-not-allowed/$method"
            params={{ method: 'undefined' }}
          >
            Server function defined without explicit method
          </Link>
        </li>
        <li>
          <Link to="/method-not-allowed/$method" params={{ method: 'post' }}>
            Server function defined with POST method
          </Link>
        </li>
      </ul>
    </div>
  )
}
