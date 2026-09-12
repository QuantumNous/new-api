/// <reference types="vite/client" />
/// <reference types="@vitejs/plugin-rsc/types" />
import * as React from 'react'
import { serverBadge, serverBox, serverHeader, timestamp } from './serverStyles'
import { ClientWidgetA } from './ClientWidgetA'

// ============================================================================
// COMPLEX PRELOAD: Server component A content with client widget A
// This is a pure server component file (no createServerFn) so vite-plugin-rsc's
// CSS transform can properly wrap the exported component
// ============================================================================

export function ComplexPreloadContentA({
  data,
  children,
}: {
  data: { title: string }
  children?: React.ReactNode
}) {
  const serverTimestamp = Date.now()

  return (
    <div style={serverBox} data-testid="server-component-a">
      <div style={serverHeader}>
        <span style={serverBadge}>SERVER COMPONENT A</span>
        <span style={timestamp} data-testid="server-a-timestamp">
          Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>

      <h2
        style={{ margin: '0 0 16px 0', color: '#0c4a6e' }}
        data-testid="server-a-title"
      >
        {data.title}
      </h2>

      <p style={{ margin: '0 0 16px 0', color: '#0369a1', fontSize: '14px' }}>
        This server component renders ClientWidgetA directly and accepts
        ClientWidgetB via children slot.
      </p>

      {/* ClientWidgetA rendered DIRECTLY inside server component */}
      <ClientWidgetA title="Widget A (Direct)" />

      {/* ClientWidgetB passed via children slot from route component */}
      <div data-testid="server-a-slot">{children}</div>
    </div>
  )
}
