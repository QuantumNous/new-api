import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { formatTime, pageStyles } from '~/utils/styles'

// ============================================================================
// Three independent server functions that each return an RSC
// Used to test that parallel server function calls correctly scope
// their decode promise tracking without cross-contamination.
// ============================================================================

const getParallelRscA = createServerFn({ method: 'GET' }).handler(async () => {
  const serverTimestamp = Date.now()
  const id = `A-${Math.random().toString(36).slice(2, 8)}`

  return renderServerComponent(
    <div style={serverBox} data-testid="parallel-rsc-a" data-id={id}>
      <div style={serverHeader}>
        <span style={serverBadge}>RSC A</span>
        <span style={timestamp} data-testid="parallel-rsc-a-timestamp">
          {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>
      <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
        Component A: First Parallel RSC
      </h3>
      <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
        This RSC was loaded in parallel with B and C. Each has its own unique ID
        to verify no cross-contamination occurs.
      </p>
      <div
        style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#94a3b8',
          fontFamily: 'monospace',
        }}
        data-testid="parallel-rsc-a-id"
      >
        {id}
      </div>
    </div>,
  )
})

const getParallelRscB = createServerFn({ method: 'GET' }).handler(async () => {
  const serverTimestamp = Date.now()
  const id = `B-${Math.random().toString(36).slice(2, 8)}`

  // Add small delay to ensure potential interleaving with other calls
  await new Promise((r) => setTimeout(r, 50))

  return renderServerComponent(
    <div style={serverBox} data-testid="parallel-rsc-b" data-id={id}>
      <div style={serverHeader}>
        <span style={serverBadge}>RSC B</span>
        <span style={timestamp} data-testid="parallel-rsc-b-timestamp">
          {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>
      <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
        Component B: Second Parallel RSC (Delayed)
      </h3>
      <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
        This RSC has a 50ms delay to test interleaving. Its decode promise
        should be correctly scoped to its own server function call.
      </p>
      <div
        style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#94a3b8',
          fontFamily: 'monospace',
        }}
        data-testid="parallel-rsc-b-id"
      >
        {id}
      </div>
    </div>,
  )
})

const getParallelRscC = createServerFn({ method: 'GET' }).handler(async () => {
  const serverTimestamp = Date.now()
  const id = `C-${Math.random().toString(36).slice(2, 8)}`

  return renderServerComponent(
    <div style={serverBox} data-testid="parallel-rsc-c" data-id={id}>
      <div style={serverHeader}>
        <span style={serverBadge}>RSC C</span>
        <span style={timestamp} data-testid="parallel-rsc-c-timestamp">
          {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>
      <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
        Component C: Third Parallel RSC
      </h3>
      <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
        This RSC completes quickly. All three RSCs should render without flash
        when navigating to this route.
      </p>
      <div
        style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#94a3b8',
          fontFamily: 'monospace',
        }}
        data-testid="parallel-rsc-c-id"
      >
        {id}
      </div>
    </div>,
  )
})

export const Route = createFileRoute('/rsc-parallel')({
  loader: async () => {
    // Load all RSCs in parallel - tests concurrent deserialization
    // Each server function call should correctly scope its decode promises
    const [RscA, RscB, RscC] = await Promise.all([
      getParallelRscA(),
      getParallelRscB(),
      getParallelRscC(),
    ])
    return {
      RscA,
      RscB,
      RscC,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscParallelComponent,
})

function RscParallelComponent() {
  const { RscA, RscB, RscC, loaderTimestamp } = Route.useLoaderData()

  return (
    <div style={pageStyles.container} data-testid="rsc-parallel-container">
      <h1 data-testid="rsc-parallel-title" style={pageStyles.title}>
        Parallel RSC Loading
      </h1>
      <p style={pageStyles.description}>
        This page loads three independent RSCs in parallel using Promise.all().
        Each RSC has its own unique ID (starting with A-, B-, or C-) to verify
        that parallel server function calls correctly scope their decode
        promises without cross-contamination.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        data-testid="parallel-rsc-container"
      >
        {RscA}
        {RscB}
        {RscC}
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
          <li>Three RSCs are loaded in parallel via Promise.all()</li>
          <li>Each RSC has a unique ID (A-xxx, B-xxx, C-xxx)</li>
          <li>RSC B has a 50ms delay to test interleaving</li>
          <li>No flash should occur during client-side navigation</li>
          <li>
            Each server function call should correctly scope its decode promises
          </li>
        </ul>
      </div>
    </div>
  )
}
