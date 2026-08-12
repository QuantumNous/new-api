import { createFileRoute } from '@tanstack/solid-router'
import { Link } from '@tanstack/solid-router'

export const Route = createFileRoute('/redirect/')({
  component: () => (
    <div>
      <Link
        from={Route.fullPath}
        to="./$target"
        params={{ target: 'internal' }}
        activeProps={{
          class: 'font-bold',
        }}
      >
        internal
      </Link>{' '}
      <Link
        from={Route.fullPath}
        to="./$target"
        params={{ target: 'external' }}
        activeProps={{
          class: 'font-bold',
        }}
      >
        external
      </Link>
    </div>
  ),
})
