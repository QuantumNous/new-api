import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/not-found/')({
  component: () => {
    const preload = Route.useSearch({ select: (s) => s.preload })
    return (
      <div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-beforeLoad"
            preload={preload}
            data-testid="via-beforeLoad"
          >
            via-beforeLoad
          </Link>
        </div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-loader"
            preload={preload}
            data-testid="via-loader"
          >
            via-loader
          </Link>
        </div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-beforeLoad-target-root"
            preload={preload}
            data-testid="via-beforeLoad-target-root"
          >
            via-beforeLoad-target-root (shows global not-found)
          </Link>
        </div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./parent-boundary"
            preload={preload}
            data-testid="parent-boundary-index"
          >
            parent-boundary test cases
          </Link>
        </div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./deep"
            preload={preload}
            data-testid="deep-index"
          >
            deep test cases
          </Link>
        </div>
      </div>
    )
  },
})
