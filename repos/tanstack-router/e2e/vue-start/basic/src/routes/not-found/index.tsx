import { Link, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/not-found/')({
  component: () => {
    const preload = Route.useSearch({ select: (s) => s.preload })
    return (
      <div>
        <div class="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-beforeLoad"
            preload={preload.value}
            data-testid="via-beforeLoad"
          >
            via-beforeLoad
          </Link>
        </div>
        <div class="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-loader"
            preload={preload.value}
            data-testid="via-loader"
          >
            via-loader
          </Link>
        </div>
      </div>
    )
  },
})
