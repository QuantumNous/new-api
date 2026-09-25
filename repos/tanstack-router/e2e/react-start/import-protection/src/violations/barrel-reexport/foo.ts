/**
 * Server-only module protected by the marker import pattern.
 * Re-exported through the barrel (index.ts) but never imported by
 * barrel-false-positive.tsx — tree-shaking eliminates it from the
 * client bundle, so no import-protection violation should fire.
 */
import '@tanstack/react-start/server-only'

export function foo(): string {
  return 'server-only value from foo'
}
