import { Link, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/raw-stream/')({
  component: RawStreamIndex,
})

function RawStreamIndex() {
  return (
    <div>
      <p>Select a test category above to begin testing.</p>
      <ul class="list-disc pl-6 mt-4 space-y-2">
        <li>
          <Link to="/raw-stream/client-call" class="text-blue-500 underline">
            Client Calls
          </Link>
          <span> - Test RawStream via direct server function calls (RPC)</span>
        </li>
        <li>
          <Link
            to="/raw-stream/ssr-single"
            class="text-blue-500 underline"
            reloadDocument={true}
          >
            SSR Single
          </Link>
          <span> - Test single RawStream from route loader (SSR)</span>
        </li>
        <li>
          <Link
            to="/raw-stream/ssr-multiple"
            class="text-blue-500 underline"
            reloadDocument={true}
          >
            SSR Multiple
          </Link>
          <span> - Test multiple RawStreams from route loader (SSR)</span>
        </li>
        <li>
          <Link
            to="/raw-stream/ssr-mixed"
            class="text-blue-500 underline"
            reloadDocument={true}
          >
            SSR Mixed
          </Link>
          <span>
            {' '}
            - Test RawStream mixed with deferred data from loader (SSR)
          </span>
        </li>
        <li>
          <Link
            to="/raw-stream/ssr-text-hint"
            class="text-blue-500 underline"
            reloadDocument={true}
          >
            SSR Text Hint
          </Link>
          <span> - Test RawStream with hint: 'text' from loader (SSR)</span>
        </li>
        <li>
          <Link
            to="/raw-stream/ssr-binary-hint"
            class="text-blue-500 underline"
            reloadDocument={true}
          >
            SSR Binary Hint
          </Link>
          <span> - Test RawStream with hint: 'binary' from loader (SSR)</span>
        </li>
      </ul>
    </div>
  )
}
