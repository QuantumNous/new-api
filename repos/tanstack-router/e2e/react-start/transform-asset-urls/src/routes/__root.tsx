/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import '~/styles/app.css'

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
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent
          assetCrossOrigin={{
            script: 'anonymous',
            stylesheet: 'use-credentials',
          }}
        />
      </head>
      <body>
        <div className="app-styled">
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  )
}
