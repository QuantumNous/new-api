import { Link, createFileRoute } from '@tanstack/vue-router'

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
