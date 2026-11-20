import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
  linkOptions,
} from '@tanstack/vue-router'
import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <Nav type="header" />
      <hr />
      <Outlet />
      <hr />
      <Nav type="footer" />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

function Nav({ type }: { type: 'header' | 'footer' }) {
  const Elem = type === 'header' ? 'header' : 'footer'
  const prefix = type === 'header' ? 'Head' : 'Foot'
  return (
    <Elem class="p-2 flex gap-2 text-lg">
      <Link
        to="/"
        activeProps={{
          class: 'font-bold',
        }}
        activeOptions={{ exact: true }}
      >
        {prefix}-/
      </Link>{' '}
      {(
        [
          linkOptions({ to: '/normal-page' }),
          linkOptions({ to: '/lazy-page' }),
          linkOptions({ to: '/virtual-page' }),
          linkOptions({ to: '/lazy-with-loader-page' }),
          linkOptions({ to: '/page-with-search', search: { where: type } }),
        ] as const
      ).map((options) => (
        <Link
          {...options}
          activeProps={{
            class: 'font-bold',
          }}
        >
          {prefix}-{options.to}
        </Link>
      ))}
    </Elem>
  )
}
