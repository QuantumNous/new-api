import { createFileRoute, Link } from '@tanstack/react-router'
import { pageStyles, colors } from '~/utils/styles'

export const Route = createFileRoute('/rsc-streaming')({
  component: RscStreamingComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-streaming')
    return <>Loading...</>
  },
})

const streamingExamples = [
  {
    path: '/rsc-stream-readable',
    title: 'ReadableStream Pattern',
    description:
      'Stream RSCs using the ReadableStream API. Click a button to start streaming notifications from the server. Uses reader.read() loop pattern.',
    icon: '📖',
    pattern: 'ReadableStream + reader.read()',
  },
  {
    path: '/rsc-stream-generator',
    title: 'Async Generator Pattern',
    description:
      'Stream RSCs using async generator functions. Cleaner syntax with for-await-of loops. Same result, more readable code.',
    icon: '🔄',
    pattern: 'async function* + for-await-of',
  },
  {
    path: '/rsc-stream-loader',
    title: 'Loader Streaming',
    description:
      'Stream RSCs from the route loader. The stream is returned from the loader and consumed progressively in the component - works for both SSR and client-side navigation.',
    icon: '📦',
    pattern: 'loader + for-await-of',
  },
]

function RscStreamingComponent() {
  return (
    <div style={pageStyles.container} data-testid="rsc-streaming-page">
      <div style={{ marginBottom: '16px' }}>
        <Link
          to="/"
          style={{
            fontSize: '13px',
            color: '#0284c7',
            textDecoration: 'none',
          }}
        >
          ← Back to all examples
        </Link>
      </div>

      <h1 data-testid="rsc-streaming-title" style={pageStyles.title}>
        RSC Streaming Examples
      </h1>
      <p style={pageStyles.description}>
        These examples demonstrate how to stream individual React Server
        Components from the server to the client. Each notification in the feed
        is a complete RSC that arrives independently, allowing for progressive
        rendering.
      </p>

      {/* Color Legend */}
      <div style={pageStyles.legend}>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.server)} />
          <span style={pageStyles.legendText}>
            Server Component (RSC) - Each notification is a complete RSC
          </span>
        </div>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.client)} />
          <span style={pageStyles.legendText}>
            Client Interactive - Expand/collapse, dismiss actions
          </span>
        </div>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.async)} />
          <span style={pageStyles.legendText}>
            Streaming - Components arriving from server
          </span>
        </div>
      </div>

      {/* Code Pattern Overview */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <h2
          style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#334155' }}
        >
          Streaming Patterns
        </h2>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>
          TanStack Start supports streaming data from server functions using two
          patterns:
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div
            style={{
              flex: '1',
              minWidth: '200px',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color: '#0f172a',
                marginBottom: '4px',
              }}
            >
              ReadableStream
            </div>
            <code
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontFamily: 'monospace',
              }}
            >
              new ReadableStream({'{'} start(controller) {'}'})
            </code>
          </div>
          <div
            style={{
              flex: '1',
              minWidth: '200px',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color: '#0f172a',
                marginBottom: '4px',
              }}
            >
              Async Generator
            </div>
            <code
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontFamily: 'monospace',
              }}
            >
              async function*() {'{'} yield rsc {'}'}
            </code>
          </div>
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
        {streamingExamples.map((example) => (
          <Link
            key={example.path}
            to={example.path as '/rsc-stream-readable'}
            data-testid={`link-${example.path.slice(1)}`}
            style={{
              display: 'block',
              padding: '16px',
              backgroundColor: '#e0f2fe',
              borderRadius: '8px',
              border: '2px solid #0284c7',
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
              style={{
                fontSize: '11px',
                color: '#0284c7',
                fontFamily: 'monospace',
                marginBottom: '8px',
                padding: '4px 8px',
                backgroundColor: 'white',
                borderRadius: '4px',
                display: 'inline-block',
              }}
            >
              {example.pattern}
            </div>
            <div
              style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}
            >
              {example.description}
            </div>
          </Link>
        ))}
      </div>

      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>Key Concepts:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Each streamed item is a complete React Server Component</li>
          <li>RSCs can have client slots for interactivity</li>
          <li>First batch arrives immediately, rest streams with delays</li>
          <li>Both ReadableStream and async generator patterns are typed</li>
          <li>SSR streaming collects all RSCs before rendering</li>
        </ul>
      </div>
    </div>
  )
}
