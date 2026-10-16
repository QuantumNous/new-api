import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/raw-stream')({
  component: RawStreamLayout,
})

function RawStreamLayout() {
  return (
    <div className="p-4 space-y-4">
      <h1>Raw Stream Tests</h1>

      <nav className="space-x-4">
        <Link
          to="/raw-stream/client-call"
          className="text-blue-500 underline"
          activeProps={{ className: 'font-bold' }}
        >
          Client Calls
        </Link>
        <Link
          to="/raw-stream/ssr-single"
          className="text-blue-500 underline"
          activeProps={{ className: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Single
        </Link>
        <Link
          to="/raw-stream/ssr-multiple"
          className="text-blue-500 underline"
          activeProps={{ className: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Multiple
        </Link>
        <Link
          to="/raw-stream/ssr-mixed"
          className="text-blue-500 underline"
          activeProps={{ className: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Mixed
        </Link>
        <Link
          to="/raw-stream/ssr-text-hint"
          className="text-blue-500 underline"
          activeProps={{ className: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Text Hint
        </Link>
        <Link
          to="/raw-stream/ssr-binary-hint"
          className="text-blue-500 underline"
          activeProps={{ className: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Binary Hint
        </Link>
        <Link to="/" className="text-gray-500 underline">
          Back to Home
        </Link>
      </nav>

      <hr />

      <Outlet />
    </div>
  )
}
