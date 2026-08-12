import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { colors } from '~/utils/styles'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
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
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-home"
          >
            Home
          </Link>
          <Link
            to="/rsc-query"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-rsc-query"
          >
            RSC Query
          </Link>
          <Link
            to="/rsc-query-no-loader-css"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
            data-testid="nav-rsc-query-no-loader-css"
          >
            Render-Suspended CSS
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
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  )
}
