import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect/$target/serverFn/')({
  component: () => (
    <div>
      <h1 className="mb-4 text-4xl font-extrabold lmd:text-5xl lg:text-6xl ">
        redirect test with server functions (target {Route.useParams().target})
      </h1>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-beforeLoad"
          activeProps={{
            className: 'font-bold',
          }}
          data-testid="via-beforeLoad"
        >
          via-beforeLoad
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-beforeLoad"
          search={{ reloadDocument: true }}
          activeProps={{
            className: 'font-bold',
          }}
          data-testid="via-beforeLoad-reloadDocument"
        >
          via-beforeLoad (reloadDocument=true)
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-loader"
          activeProps={{
            className: 'font-bold',
          }}
          data-testid="via-loader"
        >
          via-loader
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-loader"
          activeProps={{
            className: 'font-bold',
          }}
          search={{ reloadDocument: true }}
          data-testid="via-loader-reloadDocument"
        >
          via-loader (reloadDocument=true)
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-useServerFn"
          activeProps={{
            className: 'font-bold',
          }}
          data-testid="via-useServerFn"
        >
          via-useServerFn
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-useServerFn"
          activeProps={{
            className: 'font-bold',
          }}
          search={{ reloadDocument: true }}
          data-testid="via-useServerFn-reloadDocument"
        >
          via-useServerFn (reloadDocument=true)
        </Link>
      </div>
    </div>
  ),
})
