import { createFileRoute } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { formatTime, pageStyles } from '~/utils/styles'
import { getComplexPreloadServerComponentA } from '~/utils/complexPreloadServerComponentA'
import { getComplexPreloadServerComponentB } from '~/utils/complexPreloadServerComponentB'
import { ClientWidgetB } from '~/utils/ClientWidgetB'

// ============================================================================
// COMPLEX CSS PRELOAD TEST:
// 1. Server component A renders ClientWidgetA DIRECTLY inside createCompositeComponent
// 2. Server component A accepts children slot for ClientWidgetB (passed from route)
// 3. Server component B renders ClientWidgetC but is NOT rendered in route component
// ============================================================================

export const Route = createFileRoute('/rsc-css-preload-complex')({
  loader: async () => {
    // Load both server components
    const [ServerA, ServerB] = await Promise.all([
      getComplexPreloadServerComponentA({
        data: { title: 'Server Component A' },
      }),
      getComplexPreloadServerComponentB({
        data: { title: 'Server Component B (NOT RENDERED)' },
      }),
    ])

    return {
      ServerA,
      ServerB, // Loaded but NOT rendered
      loaderTimestamp: Date.now(),
    }
  },
  component: RscCssPreloadComplexComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-css-preload-complex')
    return <>Loading...</>
  },
})

function RscCssPreloadComplexComponent() {
  const { ServerA, loaderTimestamp } = Route.useLoaderData()
  // Note: ServerB is intentionally NOT used/rendered

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="page-title" style={pageStyles.title}>
        Complex CSS Preload Test
      </h1>
      <p style={pageStyles.description}>
        Tests CSS preloading with multiple client components in different
        scenarios: direct render, children slot, and unused RSC.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Render ServerA with ClientWidgetB passed as children */}
      <CompositeComponent src={ServerA}>
        <ClientWidgetB title="Widget B (Slot)" />
      </CompositeComponent>

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
        <strong>Test Scenarios:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>
            <strong>ClientWidgetA (purple):</strong> Rendered DIRECTLY inside
            createCompositeComponent - CSS should be preloaded
          </li>
          <li>
            <strong>ClientWidgetB (teal):</strong> Passed via children slot -
            CSS should be preloaded
          </li>
          <li>
            <strong>ClientWidgetC (orange):</strong> In ServerB which is loaded
            but NOT rendered - CSS should NOT be loaded (separate module)
          </li>
        </ul>
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#dbeafe',
          border: '3px solid #3b82f6',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#1e40af',
        }}
        data-testid="serverb-note"
      >
        Note: ServerB with ClientWidgetC is loaded but NOT rendered.
        ClientWidgetC uses global CSS that would turn THIS box orange if loaded.
        If this box stays blue, the test passes.
      </div>
    </div>
  )
}
