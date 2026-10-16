import { createFileRoute, Link, linkOptions } from '@tanstack/react-router'
import { pageStyles, colors } from '~/utils/styles'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

const examples = linkOptions([
  {
    to: '/rsc-query',
    title: 'RSC + React Query',
    description:
      'Product page - demonstrates RSC data fetching integrated with React Query for caching, refetching, and state management',
    icon: '🛒',
  },
  {
    to: '/rsc-query-no-loader-css',
    title: 'Render-Suspended CSS RSC',
    description:
      'React Query suspends during render instead of preloading in a route loader, then streams styled RSC HTML with CSS links intact',
    icon: '🧵',
  },
])

function IndexComponent() {
  return (
    <div style={pageStyles.container} data-testid="index-page">
      <h1 data-testid="home-title" style={pageStyles.title}>
        RSC + React Query E2E Tests
      </h1>
      <p style={pageStyles.description}>
        These examples demonstrate RSC integration with React Query, showing how
        server-rendered content (blue) and client-interactive elements (green)
        work together with React Query's caching and state management.
      </p>

      {/* Color Legend */}
      <div style={pageStyles.legend}>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.server)} />
          <span style={pageStyles.legendText}>
            Server Rendered (RSC) - Fetched via React Query
          </span>
        </div>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.client)} />
          <span style={pageStyles.legendText}>
            Client Interactive - React state, event handlers
          </span>
        </div>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.async)} />
          <span style={pageStyles.legendText}>
            Async Loading - Query fetching
          </span>
        </div>
      </div>

      {/* Examples Grid */}
      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}
      >
        {examples.map((example) => (
          <Link
            key={example.to}
            {...example}
            style={{
              display: 'block',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>
              {example.icon}
            </div>
            <div
              style={{
                fontWeight: 'bold',
                color: '#0f172a',
                marginBottom: '4px',
              }}
            >
              {example.title}
            </div>
            <div
              style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}
            >
              {example.description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
