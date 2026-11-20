import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <>
      <div>
        <h2>SSR</h2>
        <Link
          data-testid="ssr-data-only-link"
          to="/ssr/data-only"
          reloadDocument={true}
        >
          Data Only
        </Link>
        <br />
        <Link
          data-testid="ssr-stream-link"
          to="/ssr/stream"
          reloadDocument={true}
        >
          Stream
        </Link>
        <br />
        <Link
          data-testid="ssr-nested-link"
          to="/ssr/nested"
          reloadDocument={true}
        >
          Nested Classes
        </Link>
      </div>
      <div>
        <h2>Server Functions</h2>
        <Link
          data-testid="server-function-custom-error-link"
          to="/server-function/custom-error"
          reloadDocument={true}
        >
          Custom Error Serialization
        </Link>
        <br />
        <Link
          data-testid="server-functions-nested-link"
          to="/server-function/nested"
          reloadDocument={true}
        >
          Nested Classes returned from Server Function
        </Link>
      </div>
    </>
  )
}
