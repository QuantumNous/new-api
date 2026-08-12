import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div class="p-8">
      <h1 class="font-bold text-lg">Server functions E2E tests</h1>
      <ul class="list-disc p-4">
        <li>
          <Link to="/consistent">
            Consistent server function returns both on client and server for GET
            and POST calls
          </Link>
        </li>
        <li>
          <Link to="/multipart">
            submitting multipart/form-data as server function input
          </Link>
        </li>
        <li>
          <Link to="/return-null">
            Server function can return null for GET and POST calls
          </Link>
        </li>
        <li>
          <Link to="/serialize-form-data">
            Server function can correctly send and receive FormData
          </Link>
        </li>
        <li>
          <Link to="/headers">
            server function can correctly send and receive headers
          </Link>
        </li>
        <li>
          <Link to="/submit-post-formdata">
            Direct POST submitting FormData to a Server function returns the
            correct message
          </Link>
        </li>
        <li>
          <Link to="/status">
            invoking a server function with custom response status code
          </Link>
        </li>
        <li>
          <Link to="/isomorphic-fns">
            isomorphic functions can have different implementations on client
            and server
          </Link>
        </li>
        <li>
          <Link to="/env-only">
            env-only functions can only be called on the server or client
            respectively
          </Link>
        </li>
        <li>
          <Link to="/cookies">server function sets cookies</Link>
        </li>
        <li>
          <Link to="/dead-code-preserve">
            dead code elimation only affects code after transformation
          </Link>
        </li>
        <li>
          <Link to="/abort-signal">aborting a server function call</Link>
        </li>
        <li>
          <Link to="/raw-response">server function returns raw response</Link>
        </li>
        <li>
          <Link to="/function-method">Server Functions method E2E tests</Link>
        </li>
        <li>
          <Link to="/function-metadata">
            Server Functions metadata E2E tests
          </Link>
        </li>
      </ul>
    </div>
  )
}
