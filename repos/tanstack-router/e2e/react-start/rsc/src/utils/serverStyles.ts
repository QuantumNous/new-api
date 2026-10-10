// ============================================================================
// Shared Server Styles (must be defined here since this runs on server)
// These styles are used by server components to render with consistent styling
// ============================================================================

export const serverBox = {
  backgroundColor: '#e0f2fe',
  border: '2px solid #0284c7',
  borderRadius: '8px',
  padding: '16px',
}

export const serverBadge = {
  display: 'inline-block',
  backgroundColor: '#0284c7',
  color: 'white',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.5px',
}

export const serverHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
}

export const timestamp = {
  fontSize: '11px',
  color: '#64748b',
  fontFamily: 'monospace',
}
