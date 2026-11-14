import { createFileRoute, Link, linkOptions } from '@tanstack/react-router'
import { pageStyles, colors } from '~/utils/styles'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

const examples = linkOptions([
  {
    to: '/rsc-basic',
    title: 'Basic RSC',
    description:
      'User profile card - demonstrates a simple server component with no client interaction',
    icon: '👤',
  },
  {
    to: '/rsc-slots',
    title: 'RSC with Slots',
    description:
      'Dashboard widgets - server layout with client-interactive widgets that can change without refetching the RSC',
    icon: '📊',
  },
  {
    to: '/rsc-component-slot',
    title: 'RSC Component Slots',
    description:
      'Product card - pass React components as props to server components, with server-provided data flowing to client components',
    icon: '🧩',
  },
  {
    to: '/rsc-slot-jsx-args',
    title: 'RSC Slot Args (JSX)',
    description:
      'Promo card - server calls a client slot with a JSX element argument that the client renders',
    icon: '🏷️',
  },
  {
    to: '/rsc-nested-structure',
    title: 'RSC Nested Structure',
    description:
      'Multiple RSC components returned from a single function via nested object structure - access via dot notation',
    icon: '🏗️',
  },
  {
    to: '/rsc-tree',
    title: 'RSC Tree Restructuring',
    description:
      'Comment thread - RSC can be moved around the DOM tree by client components without losing state',
    icon: '🌳',
  },
  {
    to: '/rsc-multi',
    title: 'Multiple RSCs',
    description:
      'News feed - multiple independent RSCs loaded in parallel, each with their own server timestamp',
    icon: '📰',
  },
  {
    to: '/rsc-suspense',
    title: 'RSC with Suspense',
    description:
      'Analytics dashboard - demonstrates async data loading with visible streaming progress',
    icon: '⏳',
  },
  {
    to: '/rsc-link',
    title: 'RSC with Link',
    description:
      'Email notification - RSC containing a TanStack Router Link component for client-side navigation',
    icon: '🔗',
  },
  {
    to: '/rsc-param',
    title: 'RSC Path Params',
    description:
      'Dynamic /rsc-param/$id route - client navigation should not remount client components or lose state',
    icon: '🏷️',
  },
  {
    to: '/rsc-nested',
    title: 'Nested RSCs',
    description:
      'E-commerce product page - RSCs nested inside each other via client composition with interactive render props',
    icon: '🪆',
  },
  {
    to: '/rsc-invalidation',
    title: 'RSC Invalidation',
    description:
      'Product search - demonstrates RSC refetching when search params change with pagination',
    icon: '🔄',
  },
  {
    to: '/rsc-error',
    title: 'RSC Error Handling',
    description:
      'Error boundary testing - demonstrates error handling when RSC throws an error',
    icon: '⚠️',
  },
  {
    to: '/rsc-forms',
    title: 'RSC with Forms',
    description:
      'Todo list - demonstrates server state mutations with form submissions and optimistic updates',
    icon: '📝',
  },
  {
    to: '/rsc-caching',
    title: 'RSC Caching',
    description:
      'Data dashboard - demonstrates staleTime behavior and cache invalidation patterns',
    icon: '💾',
  },
  {
    to: '/rsc-external',
    title: 'RSC External API',
    description:
      'Weather widget - demonstrates RSC fetching data from external APIs on the server',
    icon: '🌐',
  },
  {
    to: '/rsc-context',
    title: 'RSC with Context',
    description:
      'User preferences - demonstrates interaction between RSC data and React Context',
    icon: '🎨',
  },
  {
    to: '/rsc-large',
    title: 'RSC Large Payload',
    description:
      'Product catalog - demonstrates performance with large RSC payloads (100+ items)',
    icon: '📦',
  },
  {
    to: '/rsc-hydration',
    title: 'RSC Hydration',
    description:
      'Timestamp display - tests for hydration mismatch detection and handling',
    icon: '💧',
  },
  {
    to: '/rsc-bundle',
    title: 'RSC Bundle',
    description:
      'Page layout - multiple RSCs (Header, Content, Footer) returned from a single server function',
    icon: '📦',
  },
  {
    to: '/rsc-deferred',
    title: 'RSC Deferred Data',
    description:
      'Analytics report - RSC renders immediately, data streams via deferred Promise rendered client-side',
    icon: '⏱️',
  },
  {
    to: '/rsc-streaming',
    title: 'RSC Streaming',
    description:
      'Notification feed - stream individual RSCs from server to client using ReadableStream or async generators',
    icon: '📡',
  },
  {
    to: '/rsc-ssr-data-only',
    title: 'RSC SSR Data-Only',
    description:
      'Analytics dashboard - loader runs on server for data, component renders on client for browser-only visualization APIs',
    icon: '📊',
  },
  {
    to: '/rsc-ssr-false',
    title: 'RSC SSR False',
    description:
      'Drawing canvas - both loader and component run on client, using localStorage for persistence and Canvas API for drawing',
    icon: '🎨',
  },
  {
    to: '/rsc-flight-api',
    title: 'RSC Flight API',
    description:
      'Low-level Flight stream APIs - renderToReadableStream, createFromFetch, createFromReadableStream for advanced use cases',
    icon: '🛫',
  },
  {
    to: '/rsc-css-modules',
    title: 'RSC CSS Modules',
    description:
      'CSS Modules in server components - demonstrates scoped styles using .module.css files within RSC',
    icon: '🎨',
  },
  {
    to: '/rsc-css-conditional',
    title: 'RSC CSS Conditional',
    description:
      'Conditional server subtrees with branch-specific CSS modules for orange and violet variants',
    icon: '🟠',
  },
  {
    to: '/rsc-global-css',
    title: 'RSC Global CSS',
    description:
      'Global CSS in server components - demonstrates plain CSS imports (import "styles.css") within RSC',
    icon: '🖌️',
  },
  {
    to: '/rsc-request-headers',
    title: 'RSC Request Headers',
    description:
      'Loader calls a server function that reads the incoming Cookie header in the RSC environment',
    icon: '🍪',
  },
  {
    to: '/rsc-server-not-found',
    title: 'RSC Server Not Found',
    description:
      'A server function throws notFound() and the route-level notFoundComponent handles it for both SSR and client navigation',
    icon: '🚧',
  },
  {
    to: '/rsc-server-redirect',
    title: 'RSC Server Redirect',
    description:
      'A server function throws redirect() and navigation lands on the redirected route for both SSR and client navigation',
    icon: '↪',
  },
  {
    to: '/rsc-react-cache',
    title: 'RSC React.cache',
    description:
      'React.cache for memoization - demonstrates deduplicating expensive computations within a single render pass',
    icon: '🧠',
  },
  {
    to: '/rsc-client-preload',
    title: 'RSC Client Preload',
    description:
      'Client component CSS preloading - tests that CSS modules in client components inside RSC are properly preloaded',
    icon: '🎯',
  },
  {
    to: '/rsc-css-preload-complex',
    title: 'RSC CSS Preload Complex',
    description:
      'Complex CSS preload scenarios - direct render, children slot, and unrendered RSC with different CSS modules',
    icon: '🧪',
  },
])

function HomeComponent() {
  return (
    <div style={pageStyles.container} data-testid="index-page">
      <h1 data-testid="home-title" style={pageStyles.title}>
        React Server Components E2E Tests
      </h1>
      <p style={pageStyles.description}>
        These examples demonstrate RSC capabilities with clear visual
        distinction between server-rendered (blue) and client-interactive
        (green) content.
      </p>

      {/* Color Legend */}
      <div style={pageStyles.legend}>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.server)} />
          <span style={pageStyles.legendText}>
            Server Rendered (RSC) - Fetched once, cached
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
            Async Loading - Streaming content
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
