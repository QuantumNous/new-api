import {
  Body,
  HeadContent,
  Html,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/vue-router'

import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  errorComponent: (props) => {
    return <p>{props.error.stack}</p>
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
})

function RootComponent() {
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </Body>
    </Html>
  )
}
