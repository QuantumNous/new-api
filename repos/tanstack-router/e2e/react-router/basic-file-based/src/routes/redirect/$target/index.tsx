import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

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
            data-testid={'via-beforeLoad'}
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
            data-testid={'via-beforeLoad-reloadDocument'}
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
            data-testid={'via-loader'}
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
            data-testid={'via-loader-reloadDocument'}
          >
            via-loader (reloadDocument=true)
          </Link>
        </div>
        {/* Route.redirect() tests - uses relative redirect to ./destination */}
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-route-redirect-beforeLoad"
            activeProps={{
              className: 'font-bold',
            }}
            preload={preload}
            data-testid={'via-route-redirect-beforeLoad'}
          >
            via-route-redirect-beforeLoad
          </Link>
        </div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-route-redirect-loader"
            activeProps={{
              className: 'font-bold',
            }}
            preload={preload}
            data-testid={'via-route-redirect-loader'}
          >
            via-route-redirect-loader
          </Link>
        </div>
        {/* getRouteApi().redirect() tests - uses relative redirect to ./destination */}
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-routeApi-redirect-beforeLoad"
            activeProps={{
              className: 'font-bold',
            }}
            preload={preload}
            data-testid={'via-routeApi-redirect-beforeLoad'}
          >
            via-routeApi-redirect-beforeLoad
          </Link>
        </div>
        <div className="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-routeApi-redirect-loader"
            activeProps={{
              className: 'font-bold',
            }}
            preload={preload}
            data-testid={'via-routeApi-redirect-loader'}
          >
            via-routeApi-redirect-loader
          </Link>
        </div>
      </div>
    )
  },
})
