/**
 * This component accesses `window` at module scope, which would throw
 * if this module is ever imported on the server. The compiler optimization
 * for <ClientOnly> ensures this module is DCE'd from the server bundle
 * entirely, preventing the error.
 */

// This throws at module import time on the server since `window` doesn't exist
const initialWidth = window.innerWidth
const initialHeight = window.innerHeight

export function WindowSize() {
  return (
    <div data-testid="window-size">
      <p data-testid="window-width">Window width: {initialWidth}</p>
      <p data-testid="window-height">Window height: {initialHeight}</p>
    </div>
  )
}
