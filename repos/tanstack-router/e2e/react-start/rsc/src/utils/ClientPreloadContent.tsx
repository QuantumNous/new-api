/// <reference types="vite/client" />
/// <reference types="@vitejs/plugin-rsc/types" />
import { serverBadge, serverBox, serverHeader, timestamp } from './serverStyles'
import { ClientWidget } from './ClientWidget'

// ============================================================================
// CLIENT PRELOAD: Server component content with client widget
// This is a pure server component file (no createServerFn) so vite-plugin-rsc's
// CSS transform can properly wrap the exported component
// ============================================================================

export function ClientPreloadContent({ data }: { data: { title: string } }) {
  const serverTimestamp = Date.now()

  return (
    <div style={serverBox} data-testid="rsc-client-preload-server">
      <div style={serverHeader}>
        <span style={serverBadge}>SERVER COMPONENT</span>
        <span style={timestamp} data-testid="rsc-client-preload-timestamp">
          Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>

      <h2
        style={{ margin: '0 0 16px 0', color: '#0c4a6e' }}
        data-testid="rsc-client-preload-title"
      >
        {data.title}
      </h2>

      <p style={{ margin: '0 0 16px 0', color: '#0369a1', fontSize: '14px' }}>
        This server component contains a client component with CSS modules. The
        client component's JS and CSS should be preloaded in the document head.
      </p>

      {/* Client component rendered DIRECTLY inside server component */}
      <ClientWidget title="Interactive Widget" />
    </div>
  )
}
