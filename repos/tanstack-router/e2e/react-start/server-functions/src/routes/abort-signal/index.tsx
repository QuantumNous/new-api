import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/abort-signal/')({
  component: Home,
})

function Home() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-lg">
        Server functions E2E Abort Signal Tests
      </h1>
      <ul className="list-disc p-4">
        <li>
          <Link to="/abort-signal/$method" params={{ method: 'GET' }}>
            Abortable server function call with GET
          </Link>
        </li>
        <li>
          <Link to="/abort-signal/$method" params={{ method: 'POST' }}>
            Abortable server function call with POST
          </Link>
        </li>
      </ul>
    </div>
  )
}
