/**
 * Shared styles for RSC E2E tests.
 * Blue = Server Rendered (RSC)
 * Green = Client Interactive
 */

// Server-rendered content styles (blue theme)
export const serverStyles = {
  container: {
    backgroundColor: '#e0f2fe',
    border: '2px solid #0284c7',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#0284c7',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    letterSpacing: '0.5px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  timestamp: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  label: {
    color: '#0369a1',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  text: {
    color: '#0c4a6e',
  },
  muted: {
    color: '#64748b',
  },
  divider: {
    borderTop: '1px solid #bae6fd',
    margin: '12px 0',
  },
}

// Client interactive content styles (green theme)
export const clientStyles = {
  container: {
    backgroundColor: '#dcfce7',
    border: '2px solid #16a34a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#16a34a',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    letterSpacing: '0.5px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  label: {
    color: '#166534',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  text: {
    color: '#14532d',
  },
  divider: {
    borderTop: '1px solid #bbf7d0',
    margin: '12px 0',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'opacity 0.2s',
  },
  primaryButton: {
    backgroundColor: '#16a34a',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    color: '#334155',
  },
}

// Async/Loading content styles (amber theme for pending states)
export const asyncStyles = {
  container: {
    backgroundColor: '#fef3c7',
    border: '2px dashed #f59e0b',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#f59e0b',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    letterSpacing: '0.5px',
  },
  loadingBar: {
    height: '4px',
    backgroundColor: '#fde68a',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: '#f59e0b',
    animation: 'loading 1.5s ease-in-out infinite',
  },
}

// Page layout styles
export const pageStyles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    color: '#1e293b',
  },
  description: {
    color: '#64748b',
    marginBottom: '20px',
    lineHeight: '1.5',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    flexWrap: 'wrap' as const,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendColor: (color: string) => ({
    width: '16px',
    height: '16px',
    backgroundColor: color,
    borderRadius: '4px',
  }),
  legendText: {
    fontSize: '13px',
    color: '#475569',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#334155',
    marginBottom: '12px',
  },
}

// Color constants for easy reference
export const colors = {
  server: '#0284c7',
  serverLight: '#e0f2fe',
  client: '#16a34a',
  clientLight: '#dcfce7',
  async: '#f59e0b',
  asyncLight: '#fef3c7',
}

/**
 * Format a timestamp for display.
 * Uses a fixed UTC format to avoid hydration mismatch between server and client.
 */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss} UTC`
}
