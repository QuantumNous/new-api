import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
  linkOptions,
} from '@tanstack/solid-router'
import { Dynamic } from 'solid-js/web'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'

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
    <Dynamic component={Elem} class="p-2 flex gap-2 text-lg">
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
      ).map((options, i) => (
        <Link
          {...options}
          activeProps={{
            class: 'font-bold',
          }}
        >
          {prefix}-{options.to}
        </Link>
      ))}
    </Dynamic>
  )
}
