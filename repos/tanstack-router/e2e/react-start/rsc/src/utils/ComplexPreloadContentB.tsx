/// <reference types="vite/client" />
/// <reference types="@vitejs/plugin-rsc/types" />
import { serverBadge, serverBox, serverHeader, timestamp } from './serverStyles'
import { ClientWidgetC } from './ClientWidgetC'

// ============================================================================
// COMPLEX PRELOAD: Server component B content with client widget C
// This is a pure server component file (no createServerFn) so vite-plugin-rsc's
// CSS transform can properly wrap the exported component
// ============================================================================

export function ComplexPreloadContentB({ data }: { data: { title: string } }) {
  const serverTimestamp = Date.now()

  return (
    <div style={serverBox} data-testid="server-component-b">
      <div style={serverHeader}>
        <span style={serverBadge}>SERVER COMPONENT B</span>
        <span style={timestamp} data-testid="server-b-timestamp">
          Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>

      <h2
        style={{ margin: '0 0 16px 0', color: '#0c4a6e' }}
        data-testid="server-b-title"
      >
        {data.title}
      </h2>

      {/* ClientWidgetC rendered inside server component B */}
      <ClientWidgetC title="Widget C (In Unused RSC)" />
    </div>
  )
}
