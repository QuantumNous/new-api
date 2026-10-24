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
      { title: 'Import Protection Custom Config E2E' },
    ],
  }),
  component: RootComponent,
})

const navLinks = linkOptions([
  { to: '/', label: 'Home' },
  { to: '/backend-leak', label: 'Backend Leak' },
  { to: '/frontend-leak', label: 'Frontend Leak' },
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
