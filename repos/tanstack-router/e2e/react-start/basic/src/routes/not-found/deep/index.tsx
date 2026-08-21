import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/not-found/deep/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./b/c/d"
          search={{ throwAt: 'd' }}
          data-testid="deep-throwAt-d"
        >
          /not-found/deep/b/c/d?throwAt=d
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./b/c/d"
          search={{ throwAt: 'c' }}
          data-testid="deep-throwAt-c"
        >
          /not-found/deep/b/c/d?throwAt=c
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./b/c/d"
          search={{ throwAt: 'b' }}
          data-testid="deep-throwAt-b"
        >
          /not-found/deep/b/c/d?throwAt=b
        </Link>
      </div>
    </div>
  )
}
