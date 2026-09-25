import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-lg">Server functions E2E tests</h1>
      <ul className="list-disc p-4">
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
            dead code elimination only affects code after transformation
          </Link>
        </li>
        <li>
          <Link to="/abort-signal">aborting a server function call</Link>
        </li>
        <li>
          <Link to="/async-validation">
            server function with async validation
          </Link>
        </li>
        <li>
          <Link to="/raw-response">server function returns raw response</Link>
        </li>
        <li>
          <Link to="/formdata-redirect" search={{ mode: 'js' }}>
            server function redirects when FormData is submitted (via JS)
          </Link>
        </li>
        <li>
          <Link to="/formdata-redirect" search={{ mode: 'no-js' }}>
            server function redirects when FormData is submitted (via no-JS)
          </Link>
        </li>
        <li>
          <Link to="/middleware">Server Functions Middleware E2E tests</Link>
        </li>
        <li>
          <Link to="/factory">Server Functions Factory E2E tests</Link>
        </li>
        <li>
          <Link to="/server-only-fn">
            Server Function only called by Server Environment is kept in the
            server build
          </Link>
        </li>
        <li>
          <Link to="/middleware/unhandled-exception">
            Server Functions Middleware Unhandled Exception E2E tests
          </Link>
        </li>
        <li>
          <Link to="/function-method">Server Functions method E2E tests</Link>
        </li>
        <li>
          <Link to="/function-metadata">
            Server Functions metadata E2E tests
          </Link>
        </li>
        <li>
          <Link to="/custom-fetch">
            Server function with custom fetch implementation
          </Link>
        </li>
        <li>
          <Link to="/method-not-allowed">
            Server function returns 405 when method is not allowed
          </Link>
        </li>
      </ul>
    </div>
  )
}
