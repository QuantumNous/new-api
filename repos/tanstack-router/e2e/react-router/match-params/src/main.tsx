import ReactDOM from 'react-dom/client'
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <h1 data-testid="not-found">Root not found</h1>,
})

function RootComponent() {
  return (
    <>
      <nav aria-label="Main navigation">
        <Link
          data-testid="match-en-link"
          to="/match/{$language}"
          params={{ language: 'en-US' }}
        >
          Match EN
        </Link>{' '}
        <Link
          data-testid="numeric-user-link"
          to="/users/$userId"
          params={{ userId: 456 }}
        >
          Numeric user
        </Link>{' '}
        <Link
          data-testid="username-link"
          to="/users/$username"
          params={{ username: 'alice' }}
        >
          Username
        </Link>{' '}
        <Link
          data-testid="org-settings-link"
          to="/orgs/$orgId/settings"
          params={{ orgId: 42 }}
        >
          Org settings
        </Link>{' '}
        <Link
          data-testid="ambiguous-dollar-link"
          to="/ambiguous/$value"
          params={{ value: 'alpha' }}
        >
          Ambiguous dollar
        </Link>{' '}
        <Link
          data-testid="ambiguous-curly-link"
          to="/ambiguous/{$value}"
          params={{ value: 'alpha' }}
        >
          Ambiguous curly
        </Link>
      </nav>
      <Outlet />
    </>
  )
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <h1>Match params e2e</h1>,
})

const matchLanguageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/match/{$language}',
  params: {
    parse: ({ language }) => {
      if (language === 'en') return { language: 'en-US' as const }
      if (language === 'pl') return { language: 'pl-PL' as const }
      return false
    },
    stringify: ({ language }) => {
      if (language === 'en-US') return { language: 'en' }
      if (language === 'pl-PL') return { language: 'pl' }
      return { language }
    },
  },
  component: MatchLanguageComponent,
})

function MatchLanguageComponent() {
  const params = matchLanguageRoute.useParams()
  return <h1 data-testid="match-language">Match language {params.language}</h1>
}

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
})

const numericUserRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: '$userId',
  params: {
    parse: ({ userId }) => {
      const parsed = Number(userId)
      if (!Number.isInteger(parsed)) return false
      return { userId: parsed }
    },
    stringify: ({ userId }) => ({ userId: String(userId) }),
  },
  component: NumericUserComponent,
})

function NumericUserComponent() {
  const params = numericUserRoute.useParams()
  return <h1 data-testid="numeric-user">Numeric user {params.userId}</h1>
}

const usernameRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: '$username',
  component: UsernameComponent,
})

function UsernameComponent() {
  const params = usernameRoute.useParams()
  return <h1 data-testid="username">Username {params.username}</h1>
}

const numericOrgRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orgs/$orgId',
  params: {
    parse: ({ orgId }) => {
      const parsed = Number(orgId)
      if (!Number.isInteger(parsed)) return false
      return { orgId: parsed }
    },
    stringify: ({ orgId }) => ({ orgId: String(orgId) }),
  },
})

const orgSettingsRoute = createRoute({
  getParentRoute: () => numericOrgRoute,
  path: 'settings',
  component: OrgSettingsComponent,
})

function OrgSettingsComponent() {
  const params = orgSettingsRoute.useParams()
  return <h1 data-testid="org-settings">Org settings {params.orgId}</h1>
}

const orgAboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orgs/$slug/about',
  component: OrgAboutComponent,
})

function OrgAboutComponent() {
  const params = orgAboutRoute.useParams()
  return <h1 data-testid="org-about">Org about {params.slug}</h1>
}

const ambiguousRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ambiguous',
})

const ambiguousDollarRoute = createRoute({
  getParentRoute: () => ambiguousRoute,
  path: '$value',
  params: {
    parse: ({ value }) => {
      if (!value.startsWith('dollar-')) return false
      return { value: value.slice(7) }
    },
    stringify: ({ value }) => ({ value: `dollar-${value}` }),
  },
  component: AmbiguousDollarComponent,
})

function AmbiguousDollarComponent() {
  const params = ambiguousDollarRoute.useParams()
  return <h1 data-testid="ambiguous-dollar">Dollar {params.value}</h1>
}

const ambiguousCurlyRoute = createRoute({
  getParentRoute: () => ambiguousRoute,
  path: '{$value}',
  params: {
    parse: ({ value }) => {
      if (!value.startsWith('curly-')) return false
      return { value: value.slice(6) }
    },
    stringify: ({ value }) => ({ value: `curly-${value}` }),
  },
  component: AmbiguousCurlyComponent,
})

function AmbiguousCurlyComponent() {
  const params = ambiguousCurlyRoute.useParams()
  return <h1 data-testid="ambiguous-curly">Curly {params.value}</h1>
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchLanguageRoute,
  usersRoute.addChildren([numericUserRoute, usernameRoute]),
  numericOrgRoute.addChildren([orgSettingsRoute]),
  orgAboutRoute,
  ambiguousRoute.addChildren([ambiguousDollarRoute, ambiguousCurlyRoute]),
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />)
}
