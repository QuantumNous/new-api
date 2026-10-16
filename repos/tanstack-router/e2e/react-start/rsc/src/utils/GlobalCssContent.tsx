/// <reference types="vite/client" />
/// <reference types="@vitejs/plugin-rsc/types" />
import './serverComponent.css'

// ============================================================================
// GLOBAL CSS: Info Card with Global CSS
// This is a pure server component file (no createServerFn) so vite-plugin-rsc's
// CSS transform can properly wrap the exported component
// ============================================================================

export function GlobalCssContent({
  data,
  serverInfo,
  serverTimestamp,
}: {
  data: { title?: string }
  serverInfo: {
    nodeVersion: string
    platform: string
    uptime: number
    memoryUsage: number
  }
  serverTimestamp: number
}) {
  return (
    <div className="rsc-global-container" data-testid="rsc-global-css-content">
      <div className="rsc-global-header">
        <span className="rsc-global-badge" data-testid="rsc-global-css-badge">
          SERVER RENDERED
        </span>
        <span
          className="rsc-global-timestamp"
          data-testid="rsc-global-css-timestamp"
        >
          Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>

      <h2 className="rsc-global-title" data-testid="rsc-global-css-title">
        {data.title || 'Global CSS in RSC'}
      </h2>

      <p className="rsc-global-description">
        This server component uses global CSS for styling. The styles are
        defined with regular class names (not scoped/hashed).
      </p>

      <div className="rsc-global-info-grid" data-testid="rsc-global-css-info">
        <div className="rsc-global-info-card">
          <div className="rsc-global-info-label">Node Version</div>
          <div
            className="rsc-global-info-value"
            data-testid="rsc-global-css-node-version"
          >
            {serverInfo.nodeVersion}
          </div>
        </div>
        <div className="rsc-global-info-card">
          <div className="rsc-global-info-label">Platform</div>
          <div
            className="rsc-global-info-value"
            data-testid="rsc-global-css-platform"
          >
            {serverInfo.platform}
          </div>
        </div>
        <div className="rsc-global-info-card">
          <div className="rsc-global-info-label">Uptime</div>
          <div className="rsc-global-info-value">{serverInfo.uptime}s</div>
        </div>
        <div className="rsc-global-info-card">
          <div className="rsc-global-info-label">Memory (Heap)</div>
          <div className="rsc-global-info-value">
            {serverInfo.memoryUsage} MB
          </div>
        </div>
      </div>

      <div className="rsc-global-footer">
        Component ID: global-css-{Math.random().toString(36).slice(2, 8)}
      </div>
    </div>
  )
}
