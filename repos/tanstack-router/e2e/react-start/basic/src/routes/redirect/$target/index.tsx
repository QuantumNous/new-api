import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect/$target/')({
  component: () => {
    const preload = Route.useSearch({ select: (s) => s.preload })
    return (
      <div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-beforeLoad"
            activeProps={{
              className: 'font-bold',
            }}
            preload={preload}
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
            preload={preload}
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
            preload={preload}
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
            preload={preload}
            data-testid="via-loader-reloadDocument"
          >
            via-loader (reloadDocument=true)
          </Link>
        </div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./serverFn"
            activeProps={{
              className: 'font-bold',
            }}
          >
            serverFn
          </Link>
        </div>
      </div>
    )
  },
})
