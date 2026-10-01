import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  renderServerComponent,
  createCompositeComponent,
  CompositeComponent,
} from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { clientStyles, formatTime, pageStyles } from '~/utils/styles'

// ============================================================================
// Server Component Definitions
// ============================================================================

const getMultiServerComponentA = createServerFn({
  method: 'GET',
}).handler(async () => {
  const serverTimestamp = Date.now()

  return renderServerComponent(
    <div
      style={{ ...serverBox, marginBottom: '12px' }}
      data-testid="rsc-multi-a"
    >
      <div style={serverHeader}>
        <span style={serverBadge}>ARTICLE A</span>
        <span style={timestamp} data-testid="rsc-multi-a-timestamp">
          {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>
      <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
        Breaking: New Framework Released
      </h3>
      <p
        style={{ margin: 0, color: '#64748b', fontSize: '14px' }}
        data-testid="rsc-multi-a-content"
      >
        A revolutionary new web framework promises to change how we build
        applications. Early benchmarks show 10x performance improvements.
      </p>
    </div>,
  )
})

const getMultiServerComponentB = createServerFn({
  method: 'GET',
}).handler(async () => {
  const serverTimestamp = Date.now()

  return renderServerComponent(
    <div
      style={{ ...serverBox, marginBottom: '12px' }}
      data-testid="rsc-multi-b"
    >
      <div style={serverHeader}>
        <span style={serverBadge}>ARTICLE B</span>
        <span style={timestamp} data-testid="rsc-multi-b-timestamp">
          {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>
      <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
        Industry Update: Cloud Spending Rises
      </h3>
      <p
        style={{ margin: 0, color: '#64748b', fontSize: '14px' }}
        data-testid="rsc-multi-b-content"
      >
        Enterprise cloud spending reached record highs this quarter as companies
        accelerate their digital transformation initiatives.
      </p>
    </div>,
  )
})

const getMultiServerComponentC = createServerFn({
  method: 'GET',
}).handler(async () => {
  const serverTimestamp = Date.now()

  return createCompositeComponent((props: { children?: React.ReactNode }) => {
    return (
      <div style={serverBox} data-testid="rsc-multi-c">
        <div style={serverHeader}>
          <span style={serverBadge}>ARTICLE C (WITH SLOT)</span>
          <span style={timestamp} data-testid="rsc-multi-c-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>
        <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
          Tutorial: Building with RSC
        </h3>
        <p
          style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '14px' }}
          data-testid="rsc-multi-c-content"
        >
          Learn how to leverage React Server Components for better performance
          and developer experience.
        </p>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            borderLeft: '3px solid #0284c7',
          }}
          data-testid="rsc-multi-c-children"
        >
          {props.children}
        </div>
      </div>
    )
  })
})

export const Route = createFileRoute('/rsc-multi')({
  loader: async () => {
    // Load multiple RSCs in parallel
    const [ServerA, ServerB, ServerC] = await Promise.all([
      getMultiServerComponentA(),
      getMultiServerComponentB(),
      getMultiServerComponentC(),
    ])
    return {
      ServerA,
      ServerB,
      ServerC,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscMultiComponent,
})

function RscMultiComponent() {
  const { ServerA, ServerB, ServerC, loaderTimestamp } = Route.useLoaderData()
  const [bookmarked, setBookmarked] = React.useState<Set<string>>(new Set())

  const toggleBookmark = (id: string) => {
    setBookmarked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-multi-title" style={pageStyles.title}>
        News Feed - Multiple RSCs
      </h1>
      <p style={pageStyles.description}>
        This page loads three independent RSCs in parallel. Each article has its
        own server timestamp, showing they were fetched at the same time. The
        bookmark buttons are client-interactive.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Bookmark Summary */}
      <div style={clientStyles.container}>
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>CLIENT STATE</span>
        </div>
        <div style={{ color: '#166534' }}>
          Bookmarked articles:{' '}
          {bookmarked.size === 0 ? 'None' : Array.from(bookmarked).join(', ')}
        </div>
      </div>

      <div data-testid="multi-container">
        {/* Article A with bookmark button */}
        <div style={{ position: 'relative' }}>
          {ServerA}
          <button
            onClick={() => toggleBookmark('A')}
            style={{
              position: 'absolute',
              top: '16px',
              right: '120px',
              padding: '4px 12px',
              backgroundColor: bookmarked.has('A') ? '#16a34a' : '#e2e8f0',
              color: bookmarked.has('A') ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            {bookmarked.has('A') ? '★ Saved' : '☆ Save'}
          </button>
        </div>

        {/* Article B with bookmark button */}
        <div style={{ position: 'relative' }}>
          {ServerB}
          <button
            onClick={() => toggleBookmark('B')}
            style={{
              position: 'absolute',
              top: '16px',
              right: '120px',
              padding: '4px 12px',
              backgroundColor: bookmarked.has('B') ? '#16a34a' : '#e2e8f0',
              color: bookmarked.has('B') ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            {bookmarked.has('B') ? '★ Saved' : '☆ Save'}
          </button>
        </div>

        {/* Article C with slot */}
        <CompositeComponent src={ServerC}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span data-testid="multi-c-child" style={{ color: '#166534' }}>
              Interactive content in slot
            </span>
            <button
              onClick={() => toggleBookmark('C')}
              style={{
                padding: '4px 12px',
                backgroundColor: bookmarked.has('C') ? '#16a34a' : '#e2e8f0',
                color: bookmarked.has('C') ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              {bookmarked.has('C') ? '★ Saved' : '☆ Save'}
            </button>
          </div>
        </CompositeComponent>
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>Key Points:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Multiple RSCs can be loaded in parallel</li>
          <li>Each RSC has its own independent server timestamp</li>
          <li>Client state (bookmarks) is separate from server components</li>
          <li>Article C demonstrates a slot for client-interactive content</li>
        </ul>
      </div>
    </div>
  )
}
