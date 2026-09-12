import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/redirect/$target/')({
  component: () => {
    const preload = Route.useSearch({ select: (s) => s.preload })
    return (
      <div>
        <div class="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-beforeLoad"
            activeProps={{
              class: 'font-bold',
            }}
            preload={preload()}
            data-testid="via-beforeLoad"
          >
            via-beforeLoad
          </Link>
        </div>
        <div class="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-beforeLoad"
            search={{ reloadDocument: true }}
            activeProps={{
              class: 'font-bold',
            }}
            preload={preload()}
            data-testid="via-beforeLoad-reloadDocument"
          >
            via-beforeLoad (reloadDocument=true)
          </Link>
        </div>
        <div class="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-loader"
            activeProps={{
              class: 'font-bold',
            }}
            preload={preload()}
            data-testid="via-loader"
          >
            via-loader
          </Link>
        </div>
        <div class="mb-2">
          <Link
            from={Route.fullPath}
            to="./via-loader"
            activeProps={{
              class: 'font-bold',
            }}
            search={{ reloadDocument: true }}
            preload={preload()}
            data-testid="via-loader-reloadDocument"
          >
            via-loader (reloadDocument=true)
          </Link>
        </div>
        <div class="mb-2">
          <Link
            from={Route.fullPath}
            to="./serverFn"
            activeProps={{
              class: 'font-bold',
            }}
          >
            serverFn
          </Link>
        </div>
      </div>
    )
  },
})
