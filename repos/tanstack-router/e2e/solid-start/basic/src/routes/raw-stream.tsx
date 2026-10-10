import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/raw-stream')({
  component: RawStreamLayout,
})

function RawStreamLayout() {
  return (
    <div class="p-4 space-y-4">
      <h1>Raw Stream Tests</h1>

      <nav class="space-x-4">
        <Link
          to="/raw-stream/client-call"
          class="text-blue-500 underline"
          activeProps={{ class: 'font-bold' }}
        >
          Client Calls
        </Link>
        <Link
          to="/raw-stream/ssr-single"
          class="text-blue-500 underline"
          activeProps={{ class: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Single
        </Link>
        <Link
          to="/raw-stream/ssr-multiple"
          class="text-blue-500 underline"
          activeProps={{ class: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Multiple
        </Link>
        <Link
          to="/raw-stream/ssr-mixed"
          class="text-blue-500 underline"
          activeProps={{ class: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Mixed
        </Link>
        <Link
          to="/raw-stream/ssr-text-hint"
          class="text-blue-500 underline"
          activeProps={{ class: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Text Hint
        </Link>
        <Link
          to="/raw-stream/ssr-binary-hint"
          class="text-blue-500 underline"
          activeProps={{ class: 'font-bold' }}
          reloadDocument={true}
        >
          SSR Binary Hint
        </Link>
        <Link to="/" class="text-gray-500 underline">
          Back to Home
        </Link>
      </nav>

      <hr />

      <Outlet />
    </div>
  )
}
