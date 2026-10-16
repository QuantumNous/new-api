import {
  createRootRoute,
  HeadContent,
  Link,
  linkOptions,
  Outlet,
  Scripts,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Import Protection E2E Test' },
    ],
  }),
  component: RootComponent,
})

const navLinks = linkOptions([
  { to: '/', label: 'Home' },
  { to: '/leaky-server-import', label: 'Leaky Import' },
  { to: '/alias-path-namespace-leak', label: 'Alias path namespace leak' },
  { to: '/client-only-violations', label: 'Client-Only Violations' },
  { to: '/client-only-jsx', label: 'Client-Only JSX' },
  { to: '/beforeload-leak', label: 'Beforeload Leak' },
  { to: '/component-server-leak', label: 'Component Server Leak' },
  { to: '/barrel-false-positive', label: 'Barrel False Positive' },
  { to: '/noexternal-client-pkg', label: 'noExternal Client Pkg' },
  { to: '/alias-path-leak', label: 'Alias Path Leak' },
  { to: '/non-alias-namespace-leak', label: 'Non-Alias Namespace Leak' },
  { to: '/type-only-protected-import', label: 'Type-Only Protected Import' },
])

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <nav>
          {navLinks.map((link, index) => (
            <span key={link.to}>
              {index > 0 ? ' | ' : null}
              <Link to={link.to}>{link.label}</Link>
            </span>
          ))}
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
