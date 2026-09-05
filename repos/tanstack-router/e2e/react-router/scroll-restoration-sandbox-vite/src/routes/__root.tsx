import * as React from 'react'
import {
  Link,
  Outlet,
  createRootRoute,
  linkOptions,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
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
    <Elem className="p-2 flex gap-2 text-lg">
      <Link
        to="/"
        activeProps={{
          className: 'font-bold',
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
          linkOptions({ to: '/issue-7040-source' }),
          linkOptions({ to: '/issue-7040-target' }),
        ] as const
      ).map((options, i) => (
        <Link
          key={`${prefix}-${options.to}-${i}`}
          {...options}
          activeProps={{
            className: 'font-bold',
          }}
        >
          {prefix}-{options.to}
        </Link>
      ))}
    </Elem>
  )
}
