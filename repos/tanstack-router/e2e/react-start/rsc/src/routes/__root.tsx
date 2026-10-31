import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useHydrated,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { colors } from '~/utils/styles'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const hydrated = useHydrated()

  return (
    <html>
      <head>
        <HeadContent />
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          a { color: #0284c7; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .nav-link { padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; }
          .nav-link:hover { background: #f1f5f9; text-decoration: none; }
          .nav-link.active { background: #e0f2fe; color: #0369a1; }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
          @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        `}</style>
      </head>
      <body>
        {/* Navigation */}
        <nav
          data-testid="main-nav"
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            backgroundColor: '#fff',
          }}
        >
          <span data-testid="app-hydrated" style={{ display: 'none' }}>
            {hydrated ? 'hydrated' : 'hydrating'}
          </span>

          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-home"
          >
            Home
          </Link>
          <Link
            to="/rsc-basic"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-basic"
          >
            Basic
          </Link>
          <Link
            to="/rsc-slots"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-slots"
          >
            Slots
          </Link>
          <Link
            to="/rsc-component-slot"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-component-slot"
          >
            Component Slot
          </Link>
          <Link
            to="/rsc-slot-jsx-args"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-slot-jsx-args"
          >
            Slot JSX Args
          </Link>
          <Link
            to="/rsc-tree"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-tree"
          >
            Tree
          </Link>
          <Link
            to="/rsc-multi"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-multi"
          >
            Multi
          </Link>
          <Link
            to="/rsc-suspense"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-suspense"
          >
            Suspense
          </Link>
          <Link
            to="/rsc-link"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-link"
          >
            Link
          </Link>
          <Link
            to="/rsc-nested"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-nested"
          >
            Nested
          </Link>
          <Link
            to="/rsc-invalidation"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-invalidation"
          >
            Invalidation
          </Link>
          <Link
            to="/rsc-error"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-error"
          >
            Error
          </Link>
          <Link
            to="/rsc-forms"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-forms"
          >
            Forms
          </Link>
          <Link
            to="/rsc-caching"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-caching"
          >
            Caching
          </Link>
          <Link
            to="/rsc-external"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-external"
          >
            External
          </Link>
          <Link
            to="/rsc-context"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-context"
          >
            Context
          </Link>
          <Link
            to="/rsc-large"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-large"
          >
            Large
          </Link>
          <Link
            to="/rsc-hydration"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-hydration"
          >
            Hydration
          </Link>
          <Link
            to="/rsc-bundle"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-bundle"
          >
            Bundle
          </Link>
          <Link
            to="/rsc-async-bundle"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-async-bundle"
          >
            Async Bundle
          </Link>
          <Link
            to="/rsc-deferred"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-deferred"
          >
            Deferred
          </Link>
          <Link
            to="/rsc-streaming"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-streaming"
          >
            Streaming
          </Link>
          <Link
            to="/rsc-parallel"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-parallel"
          >
            Parallel
          </Link>
          <Link
            to="/rsc-deferred-component"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-deferred-component"
          >
            Deferred RSC
          </Link>
          <Link
            to="/rsc-ssr-data-only"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-ssr-data-only"
          >
            SSR Data-Only
          </Link>
          <Link
            to="/rsc-ssr-false"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-ssr-false"
          >
            SSR False
          </Link>
          <Link
            to="/rsc-nested-structure"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-nested-structure"
          >
            Nested Structure
          </Link>
          <Link
            to="/rsc-flight-api"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-flight-api"
          >
            Flight API
          </Link>
          <Link
            to="/rsc-css-modules"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-css-modules"
          >
            CSS Modules
          </Link>
          <Link
            to="/rsc-css-conditional"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-css-conditional"
          >
            CSS Conditional
          </Link>
          <Link
            to="/rsc-global-css"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-global-css"
          >
            Global CSS
          </Link>
          <Link
            to="/rsc-request-headers"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-request-headers"
          >
            Request Headers
          </Link>
          <Link
            to="/rsc-server-not-found"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-server-not-found"
          >
            Server Not Found
          </Link>
          <Link
            to="/rsc-server-redirect"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-server-redirect"
          >
            Server Redirect
          </Link>
          <Link
            to="/rsc-react-cache"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-react-cache"
          >
            React.cache
          </Link>
          <Link
            to="/rsc-client-preload"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-client-preload"
          >
            Client Preload
          </Link>
          <Link
            to="/rsc-css-preload-complex"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-css-preload-complex"
          >
            CSS Preload Complex
          </Link>
          <Link
            to="/rsc-css-autoinject"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-css-autoinject"
          >
            CSS Auto Inject
          </Link>
          <Link
            to="/rsc-param"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-param"
          >
            Param
          </Link>

          {/* Legend */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '12px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: colors.server,
                  borderRadius: '3px',
                }}
              />
              <span style={{ color: '#64748b' }}>Server (RSC)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: colors.client,
                  borderRadius: '3px',
                }}
              />
              <span style={{ color: '#64748b' }}>Client</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: colors.async,
                  borderRadius: '3px',
                }}
              />
              <span style={{ color: '#64748b' }}>Loading</span>
            </div>
          </div>
        </nav>

        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
