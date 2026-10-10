/**
 * Server-only secret used exclusively inside a route component.
 * The route component is code-split by the router plugin into a separate
 * lazy chunk, so the import to this file ends up in the split module —
 * NOT the original route file.  Import protection must still detect this.
 */
export const COMPONENT_SECRET = 'component-only-server-secret-99999'

export function getComponentSecret() {
  return COMPONENT_SECRET
}
