import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/solid-router'
import { HydrationScript } from 'solid-js/web'

export const Route = createRootRoute({
  headers: ({ ssr }) => {
    const nonce = ssr?.nonce
    if (!nonce) return
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        `style-src 'self' 'nonce-${nonce}'`,
      ].join('; '),
    }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'CSP Nonce Test' },
    ],
    links: [{ rel: 'stylesheet', href: '/external.css' }],
    scripts: [{ src: '/external.js' }],
    styles: [
      { children: '.inline-styled { color: green; font-weight: bold; }' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
